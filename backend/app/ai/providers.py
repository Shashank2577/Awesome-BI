"""
AI Provider Abstraction Layer
Supports: Anthropic Claude, DeepSeek, and OpenAI-compatible endpoints.
Easily extendable for any LLM provider via config override.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
import json
import os
import logging

logger = logging.getLogger(__name__)


@dataclass
class AIProviderConfig:
    """Configuration for any AI provider. Base URL and key are overrideable."""
    provider: str = "anthropic"
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.1


class AIProvider(ABC):
    """Abstract base for all AI providers."""
    def __init__(self, config: AIProviderConfig):
        self.config = config

    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate a response. Returns raw text."""
        ...

    async def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Generate and parse JSON response."""
        raw = await self.generate(system_prompt, user_prompt)
        return self._extract_json(raw)

    @staticmethod
    def _extract_json(raw: str) -> Dict[str, Any]:
        content = raw.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        return json.loads(content)


# ─── Anthropic Provider ───────────────────────────────────────────
class AnthropicProvider(AIProvider):
    DEFAULT_MODEL = "claude-sonnet-4-20250514"
    DEFAULT_BASE_URL = "https://api.anthropic.com"

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        import httpx
        api_key = self.config.api_key or os.getenv("ANTHROPIC_API_KEY")
        base_url = self.config.base_url or self.DEFAULT_BASE_URL
        model = self.config.model or self.DEFAULT_MODEL
        if not api_key:
            raise ValueError("Anthropic API key not configured")
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{base_url}/v1/messages", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]


# ─── DeepSeek Provider ────────────────────────────────────────────
class DeepSeekProvider(AIProvider):
    DEFAULT_MODEL = "deepseek-chat"
    DEFAULT_BASE_URL = "https://api.deepseek.com"

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        import httpx
        api_key = self.config.api_key or os.getenv("DEEPSEEK_API_KEY")
        base_url = self.config.base_url or self.DEFAULT_BASE_URL
        model = self.config.model or self.DEFAULT_MODEL
        if not api_key:
            raise ValueError("DeepSeek API key not configured")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{base_url}/v1/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


# ─── OpenAI / Custom Provider ─────────────────────────────────────
class OpenAIProvider(AIProvider):
    """OpenAI and any OpenAI-compatible endpoint (e.g., local LLMs, proxies)."""
    DEFAULT_MODEL = "gpt-4o"
    DEFAULT_BASE_URL = "https://api.openai.com"

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        import httpx
        api_key = self.config.api_key or os.getenv("OPENAI_API_KEY")
        base_url = self.config.base_url or self.DEFAULT_BASE_URL
        model = self.config.model or self.DEFAULT_MODEL
        if not api_key:
            raise ValueError("API key not configured")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{base_url}/v1/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


# ─── Provider Factory ─────────────────────────────────────────────
PROVIDER_MAP = {
    "anthropic": AnthropicProvider,
    "deepseek": DeepSeekProvider,
    "openai": OpenAIProvider,
    "custom": OpenAIProvider,
}


def create_provider(config: AIProviderConfig) -> AIProvider:
    provider_cls = PROVIDER_MAP.get(config.provider)
    if not provider_cls:
        raise ValueError(f"Unknown provider '{config.provider}'. Available: {list(PROVIDER_MAP.keys())}")
    logger.info(f"Creating AI provider: {config.provider} (model={config.model or 'default'})")
    return provider_cls(config)


# ─── Google Gemini Provider ───────────────────────────────────────
class GeminiProvider(AIProvider):
    """Google Gemini via Generative Language API."""
    DEFAULT_MODEL = "gemini-2.0-flash"
    DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com"

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        import httpx
        api_key = self.config.api_key or os.getenv("GEMINI_API_KEY")
        model = self.config.model or self.DEFAULT_MODEL
        base_url = self.config.base_url or self.DEFAULT_BASE_URL

        if not api_key:
            raise ValueError("Gemini API key not configured")

        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        payload = {
            "contents": [{
                "parts": [{"text": full_prompt}]
            }],
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": self.config.max_tokens,
            }
        }

        url = f"{base_url}/v1beta/models/{model}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]


# ─── Updated Provider Map ─────────────────────────────────────────
PROVIDER_MAP["gemini"] = GeminiProvider


# ─── Available Providers (single definition) ──────────────────────
def get_available_providers() -> List[Dict[str, str]]:
    return [
        {"id": "anthropic", "name": "Anthropic Claude", "default_model": "claude-sonnet-4-20250514"},
        {"id": "deepseek", "name": "DeepSeek", "default_model": "deepseek-chat"},
        {"id": "openai", "name": "OpenAI (GPT-4o)", "default_model": "gpt-4o"},
        {"id": "gemini", "name": "Google Gemini", "default_model": "gemini-2.0-flash"},
        {"id": "custom", "name": "Custom OpenAI-Compatible Endpoint", "default_model": "Specify model & base URL"},
    ]
