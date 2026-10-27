# CTTRAIN Database — Technical Onboarding Reference

**Server:** `10.10.1.133,1433` (SQL Server)
**Database:** `CTTRAIN`
**Total tables:** ~255

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [How the System Works](#2-how-the-system-works)
3. [Core Entities](#3-core-entities)
4. [Employer Withholding (W3 System)](#4-employer-withholding-w3-system)
5. [Employee Wages (W2 Data)](#5-employee-wages-w2-data)
6. [Individual & Business Tax Returns](#6-individual--business-tax-returns)
7. [Return Validation & Error Handling](#7-return-validation--error-handling)
8. [Batch Processing Pipeline](#8-batch-processing-pipeline)
9. [Payments & Cash Flow In](#9-payments--cash-flow-in)
10. [Refunds & Credits](#10-refunds--credits)
11. [Assessments, Adjustments & Interest](#11-assessments-adjustments--interest)
12. [Payment Plans](#12-payment-plans)
13. [1099 & IRS Reporting](#13-1099--irs-reporting)
14. [Documents & Correspondence](#14-documents--correspondence)
15. [Configuration & Reference Data](#15-configuration--reference-data)
16. [Users, Roles & Security](#16-users-roles--security)
17. [Entity Relationship Diagram](#17-entity-relationship-diagram)
18. [Key Queries Reference](#18-key-queries-reference)

---

## 1. Introduction

CTTRAIN is the core operational database for municipal income tax administration in the City of Dublin, Ohio. It handles every aspect of local tax collection from the moment a taxpayer or employer registers with the city through the full lifecycle of filing, assessment, payment, refund, audit, and correspondence. If a dollar of tax flows through Dublin's tax office — in either direction — a record of it exists in this database.

The system serves two distinct but overlapping populations: employers who withhold city income tax from employee paychecks and remit it to the city throughout the year (the W3/withholding system), and individual residents and businesses who file annual tax returns to reconcile what they owe (the return system). These two tracks converge on the same taxpayer records and the same financial ledger, so the schema is structured to support both simultaneously.

At roughly 255 tables, CTTRAIN reflects decades of tax administration history. The transactional core — TRANSACTIONS, TRANSHST, CITWAGE, LINEDET, and RECEIPTS — is where the bulk of activity lives. Everything else either feeds into those tables, extends them, or provides configuration and reference context. Understanding those five tables will get you 80% of the way to understanding the system.

---

## 2. How the System Works

The tax administration lifecycle begins when an employer registers with the city. Businesses operating in Dublin are required to withhold city income tax from their employees' wages, just as they withhold federal and state tax. Each employer is assigned an account and is expected to make withholding payments on a regular schedule — monthly, quarterly, or semi-annually depending on their payroll size. At the end of each calendar year, the employer files a W3 reconciliation form declaring the total wages paid and total tax withheld across all employees. Simultaneously, they submit W2 records for every employee, showing each person's individual earnings and withholding amounts. This data arrives either as paper forms processed by staff or as electronic tape files from payroll processors.

Once W2 and W3 data is in the system, it becomes the benchmark against which individual employee tax returns are compared. Individual residents and non-residents who earned income in Dublin must file annual tax returns, typically by April 15. The return declares wages, other income sources, deductions, credits for taxes paid to other cities, and arrives at a final tax liability. If withholding covered more than the liability, the taxpayer is owed a refund. If it fell short, a balance is due. Business entities follow a similar process but may also carry net operating losses forward into future years. Returns arrive as paper forms (scanned and keyed by staff), electronic uploads, or batch files from tax preparation services.

Every return passes through a validation pipeline before it is posted to the official record. The system checks math, cross-references W2 data, verifies that reported wages match what employers reported, and flags discrepancies as errors or warnings. Returns with unresolved errors are held in suspension until a staff member reviews and corrects them. Clean returns are posted to the master return table and their line items are permanently recorded.

Money flows in multiple directions. Payments arrive from employers making periodic withholding remittances, from taxpayers paying balances due with their returns, and from taxpayers responding to assessments or notices. Each payment is captured as a receipt, grouped into a daily cashier batch, and eventually recorded in a bank deposit. On the outbound side, refunds are processed in batches — the system generates check records, prints and mails physical checks, and tracks whether each check has cleared. Overpayments can also be carried forward as credits against future years rather than refunded.

When a taxpayer or employer has not paid what they owe, the system can generate an assessment — a formal statement of liability with penalty and interest. Assessments can be manually adjusted upward or downward to correct errors, waive penalties, or settle disputes. Taxpayers who cannot pay their full balance in one payment can enter into an installment agreement, and the system maintains a full amortization schedule tracking each payment against the plan.

Auditors review complex cases, and their work is tracked through the assignment fields on employer and return records. All correspondence — notices, demand letters, audit findings — is generated from templates, stored in the document system, and logged against the taxpayer's account. The entire history of every account is fully auditable: every address change, every transaction, every error raised and resolved is preserved with a user, a timestamp, and a reason code.

---

## 3. Core Entities

The tables in this section form the foundational identity layer of the system. Every other domain — withholding, returns, payments, refunds — is anchored to records here. When you are tracing any piece of data through the system, you will almost always end up joining back to TAXPAYER.

### TAXPAYER

TAXPAYER is the master identity record for every individual, business, or partnership registered with the Dublin tax office. A single TAXID (Social Security Number for individuals, Federal Employer Identification Number for businesses) ties together every return, every payment, every piece of correspondence, and every W2 that person or entity has ever generated. The record is deliberately minimal — just enough to establish identity and status — with contact details, addresses, and account associations living in their own related tables.

The FILETYPE column is the most important classification field: it tells the system whether this taxpayer is a resident, non-resident, or business entity, which in turn drives which tax forms apply, which rates apply, and what credits are available. The RECSTATUS field controls whether the account is considered active for filing purposes.

```sql
CREATE TABLE TAXPAYER (
    TAXID       CHAR(10)     NOT NULL,  -- Primary key: SSN for individuals, FEIN for businesses
    LNAME       VARCHAR(40),            -- Last name (individuals) or full business name
    FNAME       VARCHAR(20),            -- First name — blank for business entities
    MIDLI       CHAR(1),                -- Middle initial
    ADDR1       VARCHAR(40),            -- Street address line 1
    STNO        VARCHAR(10),            -- Street number (sometimes separate from ADDR1)
    APARTMENT   CHAR(10),               -- Apartment or unit number
    ZIPCODE     CHAR(5),                -- Five-digit ZIP code
    PLUS4       CHAR(4),                -- ZIP+4 extension
    EMAIL       VARCHAR(80),            -- Primary email address
    PHONE       CHAR(20),               -- Primary phone number
    DOB         DATETIME,               -- Date of birth (individuals only)
    FILETYPE    CHAR(1),                -- R=Resident, N=Non-resident, B=Business
    RESCODE     CHAR(2),                -- Residency subclassification code
    RECSTATUS   CHAR(1),                -- A=Active, I=Inactive, D=Deleted
    DBA         CHAR(40),               -- Doing-Business-As name for sole proprietors
    NAICSCODE   CHAR(6),                -- NAICS industry classification code
    CREATEDATE  DATETIME,               -- When this taxpayer was first registered
    STARTDATE   DATETIME,               -- Date the taxpayer became active in the system
    ENDDATE     DATETIME,               -- Date the taxpayer was deactivated (if applicable)
    TPID        INT,                    -- Internal numeric ID (auto-increment, used in some joins)
    PAYERMEMO   TEXT                    -- Free-text staff notes on this taxpayer
);
```

**Joins outward to:** EMPLOYER, ACCOUNTS, CITMSTR, ADDRESSES, ADDRHST, CONTACTS, DEPENDENTS, PARTNERS, CITWAGE — essentially everything in the system links back here via TAXID.

---

### ACCOUNTS

A single taxpayer can have multiple accounts, one per city jurisdiction or tax type. The ACCOUNTS table provides the linkage layer between a taxpayer identity and the specific jurisdictional context of their filing obligation. The RWTYPE field is the key discriminator: "R" accounts belong to return filers (individuals and businesses), while "W" accounts belong to employers in the withholding system. The ACCOUNTID foreign key appears throughout the schema — in EMPLOYER, CITMSTR, RECEIPTS, and REFUNDS — as the standard way to identify which city jurisdiction a transaction belongs to.

```sql
CREATE TABLE ACCOUNTS (
    ACCOUNTID      INT          NOT NULL,  -- Primary key — surrogate identifier for this account
    TAXID          CHAR(10),               -- FK → TAXPAYER — who owns this account
    ACCOUNTNUMBER  CHAR(20),               -- Human-readable account number shown on bills and notices
    CITYID         INT,                    -- FK → INSOURCECITY — which city/jurisdiction this account covers
    RWTYPE         CHAR(1),                -- R=Return filer account, W=Withholding account
    RECSTATUS      CHAR(1),                -- A=Active, I=Inactive
    STARTDATE      DATETIME,               -- Date this account became effective
    ENDDATE        DATETIME,               -- Date this account was closed (null if still active)
    ACCOUNTMEMO    TEXT                    -- Staff notes specific to this account
);
```

---

### CONTACTS

Phone numbers, email addresses, and fax numbers are stored separately from the main TAXPAYER record to allow multiple contact points per taxpayer and to support the contact type lookup. A taxpayer might have a home phone, a cell phone, a work fax, and a business email — each gets its own row here. The CONTACTTYPES lookup table defines the valid codes: PHONE, CELL, FAX, EMAIL, and similar.

```sql
CREATE TABLE CONTACTS (
    TAXID        CHAR(10),    -- FK → TAXPAYER
    CONTACTTYPE  CHAR(4),     -- FK → CONTACTTYPES: PHONE, CELL, FAX, EMAIL, etc.
    CONTACTINFO  VARCHAR(80)  -- The actual contact value (phone number, email address, etc.)
);
```

---

### ADDRESSES + ADDRHST

Current mailing and physical addresses live in ADDRESSES, where multiple rows per taxpayer allow separate mailing and physical locations with effective date ranges. Every change to a taxpayer's address is archived in ADDRHST, which records who made the change, when it was made, what the address was before, and why it changed. This history is essential for audits — it lets staff determine what address a notice was mailed to at any point in the past.

```sql
CREATE TABLE ADDRESSES (
    TAXID         CHAR(10),    -- FK → TAXPAYER
    SEQ           INT,         -- Address sequence number (distinguishes multiple addresses per taxpayer)
    STNO          VARCHAR(10), -- Street number
    ADDR1         VARCHAR(40), -- Street address line 1
    ADDR2         VARCHAR(40), -- Street address line 2 (apartment, suite, etc.)
    ZIPCODE       CHAR(5),     -- ZIP code
    PLUS4         CHAR(4),     -- ZIP+4
    ADDRESS_TYPE  CHAR(1),     -- M=Mailing, P=Physical
    FROMDATE      DATETIME,    -- Date this address became effective
    TODATE        DATETIME     -- Date this address was superseded (null = currently active)
);

CREATE TABLE ADDRHST (
    TAXID        CHAR(10),    -- FK → TAXPAYER
    DATE_FROM    DATETIME,    -- Start date of the address being recorded
    DATE_TO      DATETIME,    -- End date of the address being recorded
    DATE_POSTED  DATETIME,    -- Timestamp when this history record was written
    QUSER        CHAR(10),    -- Short ID of the user who made the change
    REASONCODE   CHAR(4),     -- Coded reason for the address change
    LAST_NAME    VARCHAR(40), -- Taxpayer's last name at time of change
    FIRST_NAME   VARCHAR(20), -- Taxpayer's first name at time of change
    ADDR_1       VARCHAR(40), -- Full address line at time of change
    ZIPCODE      CHAR(5),     -- ZIP code at time of change
    STATE        CHAR(2)      -- State abbreviation at time of change
);
```

---

### DEPENDENTS

This table captures dependent information for individual filers — child names, SSNs, dates of birth, and relationship codes. It is defined in the schema for future use; dependent tracking may be handled elsewhere or may not yet be activated for Dublin's filing requirements.

```sql
CREATE TABLE DEPENDENTS (
    TAXID         CHAR(10),    -- FK → TAXPAYER (the primary filer)
    TAXYEAR       CHAR(4),     -- Tax year of the filing claiming this dependent
    SSN           CHAR(11),    -- Dependent's Social Security Number
    FNAME         VARCHAR(20), -- Dependent's first name
    LNAME         VARCHAR(40), -- Dependent's last name
    DOB           DATETIME,    -- Dependent's date of birth
    RELATIONSHIP  VARCHAR(20)  -- Relationship to the taxpayer (Child, Spouse, etc.)
);
```

---

### PARTNERS

Partnerships pass income through to individual partners, who then owe tax on their allocated share. This table records the income and tax allocation for each partner in each partnership for each year. The TAXID column identifies the partnership entity, while PARTNERID identifies the individual partner receiving the pass-through. The CITYID column ties the allocation to a specific jurisdiction.

```sql
CREATE TABLE PARTNERS (
    TAXID     CHAR(10),     -- FK → TAXPAYER (the partnership entity)
    TAXYEAR   CHAR(4),      -- Tax year of the partnership return
    PARTNERID CHAR(10),     -- FK → TAXPAYER (the individual partner)
    INCOME    MONEY,        -- Income allocated to this partner for this year
    TAXPAID   MONEY,        -- Tax withheld on behalf of this partner
    TAX       NUMERIC(9,6), -- Tax rate applied to this partner's allocation
    CITYID    INT           -- FK → INSOURCECITY — jurisdiction of the income
);
```

---

## 4. Employer Withholding (W3 System)

Every business that pays wages to employees working in Dublin must withhold city income tax from those wages and remit that money to the city throughout the year. The W3 system — named after the IRS form W-3 that summarizes W-2 data — tracks this entire employer withholding lifecycle. At year-end, employers submit a reconciliation (the W3) showing total wages paid and total tax withheld across all employees. The system then compares that declaration against the periodic payments the employer made during the year to determine whether they are in balance, have overpaid, or still owe.

The W3 system is distinct from the individual return system: it deals with what employers owe as agents of the city, not what employees owe on their personal taxes. An employer who fails to remit withheld taxes is assessed and penalized independently of any individual employee's filing status.

### EMPLOYER

This is the central W3 record. There is one row per employer per tax year, and it serves as the financial summary for that employer's entire withholding obligation for the year. Every field on the Employer Withholdings Reconciliation screen in the tax office software maps to a column in this table. The balance calculation — what the employer currently owes — is derived from: (assessed liability) + (penalty and interest) - (payments made) - (refunds issued) + (adjustments). The CURRENTBALANCE column stores this running total.

```sql
CREATE TABLE EMPLOYER (
    EMPLOYERTAXID        CHAR(10)   NOT NULL, -- Federal EIN — the employer's tax identifier
    TAXYEAR              CHAR(4)    NOT NULL, -- Tax year this record covers (e.g., '2024')
    ACCOUNTID            INT,                 -- FK → ACCOUNTS — links to the employer's withholding account
    NUMBEROFW2S          INT,                 -- Count of W2s the employer filed for this year
    W3GROSSWAGES         MONEY,               -- Total gross wages reported on the W3 reconciliation form
    W3WITHHOLDINGS       MONEY,               -- Total city tax withheld as declared on the W3
    REPORTEDWH           MONEY,               -- W3 liability — the employer's declared withholding obligation
    W3POSTDATE           DATETIME,            -- Date the W3 reconciliation was officially posted
    W3POSTSTATUS         CHAR(1),             -- Y=W3 has been posted as final; N=pending
    W3CF                 MONEY,               -- Credits carried forward from prior years
    W3CFOR               CHAR(1),             -- Flag indicating whether a credit carryforward exists
    YTDWITHHOLDINGPAYMENTS MONEY,             -- Year-to-date withholding payments received from this employer
    YTDREFUNDS           MONEY,               -- Total refunds issued to this employer for this year
    ADJUSTMENTS          MONEY,               -- Net manual adjustments applied to the account
    ASSESSMENTS          MONEY,               -- Total assessments charged to this employer
    CURRENTBALANCE       MONEY,               -- Current outstanding balance (positive = employer owes city)
    ASSESSMENTBALANCE    MONEY,               -- Balance attributable to formal assessments only
    PENALTY_CHARGED      MONEY,               -- Total penalty charged on this account
    INTEREST_CHARGED     MONEY,               -- Total interest charged on this account
    OTHERFEES            MONEY,               -- Miscellaneous fees
    FEES                 MONEY,               -- Additional fee total
    ASSESSPENALTY        MONEY,               -- Penalty charged through the assessment process
    ASSESSINTEREST       MONEY,               -- Interest charged through the assessment process
    PAYMENTFREQUENCY     CHAR(1),             -- M=Monthly, Q=Quarterly, S=Semi-annual remittance schedule
    TRANSACTIONNUMBER    CHAR(20),            -- Transaction number for audit trail linkage
    AUDITORID            INT,                 -- FK → AUDITORS — which auditor is assigned to this account
    RESIDENCY            CHAR(1),             -- R=Resident employer, N=Non-resident employer
    RECORDSTATUS         CHAR(1),             -- A=Active, I=Inactive
    BANKRUPT             CHAR(1),             -- Y if the employer has filed for bankruptcy
    BANKRUPTDATE         DATETIME,            -- Date bankruptcy was filed
    DUEDATE              DATETIME,            -- W3 due date for this tax year
    RECEIVED             DATETIME,            -- Date the W3 was received by the city
    STARTDATE            DATETIME,            -- Date the employer's withholding obligation started
    STOPDATE             DATETIME,            -- Date the employer's withholding obligation ended
    BATCHID              INT,                 -- FK → WHBATCH — the batch this W3 was processed in
    PAYROLLID            INT,                 -- FK → PAYROLL — the payroll processor handling this employer
    LIABILITYPERCENT     NUMERIC(5,2),        -- Percentage of total liability this employer accounts for
    WMEMO                TEXT,                -- Staff memo field for notes on this account
    AMENDED              CHAR(1),             -- Y if an amended W3 has been filed
    ELECTRONICDOWNLOAD   CHAR(1),             -- Y if filed electronically (vs. paper)
    ESTPENALTY           MONEY,               -- Estimated filing penalty component
    LATEPENALTY          MONEY,               -- Late filing penalty component
    ESTINTEREST          MONEY,               -- Interest on estimated underpayment
    LATEINTEREST         MONEY,               -- Interest on late payment
    EOYPENALTY           MONEY,               -- End-of-year reconciliation penalty
    EOYINTEREST          MONEY,               -- End-of-year reconciliation interest
    PAYMENTPLANAMOUNT    MONEY,               -- Amount of outstanding balance currently on a payment plan
    PAYPLANSTATUS        CHAR(1)              -- Status of any active payment plan for this employer
);
```

---

### EMPPAYROLL

EMPPAYROLL is a link table connecting employers to payroll processing companies. An employer may use a third-party payroll service (ADP, Paychex, etc.) to prepare and submit their withholding data; this table records that relationship.

---

### PAYROLL

Master records for payroll service providers. The table is defined and the structure is ready, but no payroll companies have been loaded yet. When populated, this table would allow the system to group all employers using the same payroll processor for bulk tape processing.

```sql
CREATE TABLE PAYROLL (
    SEQID        INT          NOT NULL,  -- Primary key — surrogate ID for the payroll company
    COMPANYNAME  VARCHAR(80),            -- Full legal name of the payroll service company
    FEIN         CHAR(10),               -- Federal EIN of the payroll company
    PHONE        CHAR(20),               -- Primary contact phone number
    ADDRESS1     CHAR(40),               -- Address line 1
    ADDRESS2     CHAR(40),               -- Address line 2
    ADDRESS3     CHAR(40)                -- Address line 3 (city, state, ZIP combined or overflow)
);
```

---

### WHBATCH

Withholding batches are the processing containers for W3 submissions. When a group of W3 forms arrives — whether as paper submissions processed by a single clerk on a single day or as an electronic tape file — they are grouped into a WHBATCH record. The batch tracks totals across all employers in the group, and its status moves from active to closed as the returns are processed and posted.

```sql
CREATE TABLE WHBATCH (
    BATCHID      INT          NOT NULL,  -- Primary key — unique batch identifier
    USERSHORTID  CHAR(10),               -- Short login ID of the user who created the batch
    BATCHSTATUS  CHAR(1),                -- A=Active (still being worked), C=Closed (fully processed)
    WAGETOTAL    NUMERIC,                -- Sum of all wages across employers in this batch
    WITHTOTAL    NUMERIC,                -- Sum of all withholdings across employers in this batch
    CREATEDATE   DATETIME,               -- When the batch was opened
    CALCDATE     DATETIME,               -- When the batch was processed/calculated
    BATCHCODE    CHAR(4),                -- Classification code for the type of batch
    SOURCE       CHAR(4),                -- Source indicator (paper, tape, web, etc.)
    SPECIALTYPE  CHAR(4)                 -- Special processing flag for non-standard batches
);
```

---

### W3TAPE

When a payroll processor submits withholding data electronically, the file is registered as a W3TAPE record before its contents are parsed and loaded into the employer and employee staging tables. Each tape record identifies the submitting organization, the file it came from, and whether the file has been fully processed.

```sql
CREATE TABLE W3TAPE (
    TAPEID    INT          NOT NULL,  -- Primary key — unique identifier for this tape/file submission
    TAXYEAR   CHAR(4),                -- Tax year the data in this file pertains to
    SENDER    VARCHAR(80),            -- Name of the organization that submitted the file
    FEIN      CHAR(10),               -- FEIN of the submitting employer or payroll processor
    DATEREAD  DATETIME,               -- Date the file was received and read by the system
    PROCESSED CHAR(1),                -- Y=All records in the file have been posted; N=Still staging
    FILENAME  VARCHAR(120),           -- Original filename of the submitted tape/file
    CITYID    INT                     -- FK → INSOURCECITY — city this tape was submitted for
);
```

---

### W3EMPLOYER

When a W3 tape is loaded, employer-level summary records are written here first. They sit in staging until the import process validates and posts them to the EMPLOYER table, at which point the staging rows are cleared. The table is currently empty because all pending tapes have been processed.

```sql
CREATE TABLE W3EMPLOYER (
    TAPEID         INT,       -- FK → W3TAPE — which tape this record came from
    EMPLOYERTAXID  CHAR(10),  -- Employer EIN from the tape
    TAXYEAR        CHAR(4),   -- Tax year from the tape
    ADDR           CHAR(40),  -- Employer address from the tape
    CITY           CHAR(30),  -- Employer city from the tape
    STATE          CHAR(2),   -- Employer state from the tape
    ZIPCODE        CHAR(10),  -- Employer ZIP from the tape
    LOADORDER      INT,       -- Processing sequence within the tape
    CITYID         INT        -- FK → INSOURCECITY — jurisdiction
);
```

---

### W3EMPLOYEE

Employee-level W3 tape records are staged here before being posted to CITWAGE. Like W3EMPLOYER, this table is empty when all tapes have been processed. During an active tape load, it holds individual employee wage and withholding records from the tape file.

```sql
CREATE TABLE W3EMPLOYEE (
    EMPLOYERTAXID  CHAR(10),    -- Employer EIN — links back to EMPLOYER
    TAXID          CHAR(11),    -- Employee SSN
    TAXYEAR        CHAR(4),     -- Tax year of the W2 data
    LNAME          VARCHAR(40), -- Employee last name as reported on the tape
    FNAME          VARCHAR(20), -- Employee first name
    MIDLI          CHAR(1),     -- Middle initial
    ADDR           CHAR(40),    -- Employee address from tape
    CITY           CHAR(30),    -- Employee city from tape
    STATE          CHAR(2),     -- Employee state from tape
    ZIPCODE        CHAR(10),    -- Employee ZIP from tape
    TAXABLE        MONEY,       -- Taxable wages reported for this employee
    WITHHOLDING    MONEY,       -- City tax withheld from this employee
    LOCALENTITY    CHAR(6),     -- Local entity/tax district code
    TAPEID         INT          -- FK → W3TAPE — which tape this record came from
);
```

---

## 5. Employee Wages (W2 Data)

A W-2 is the federal form that reports an individual employee's annual wages and the taxes withheld from their paycheck. Employers issue W-2s to their employees each January and submit copies to tax authorities. In CTTRAIN, W2 data is the bridge between what employers report and what individual employees declare on their personal tax returns. When an employee files their Dublin return and reports wages from a particular employer, the system can cross-reference those figures against the W2 data the employer already submitted.

The W2 data also drives the city's ability to identify residents who may have earned income in Dublin but have not filed a return — a process called "discovery" in the tax administration world.

### CITWAGE

CITWAGE is the primary W2 data store — one row per employee per employer per tax year. At nearly 2.8 million rows it is the largest table in the withholding system. Every column in this table comes either from the W2 itself (wages, withholdings, federal/state wage boxes) or from the processing that happens when the W2 is posted (post dates, status flags, resident vs. non-resident classification). The TOTALWAGES column is the gross wages number; TRWAGES (taxable resident wages) is what the actual tax calculation is based on after allocations between resident and non-resident work.

```sql
CREATE TABLE CITWAGE (
    TAXID        CHAR(10)   NOT NULL,  -- Employee SSN — FK → TAXPAYER
    TAXYEAR      CHAR(4)    NOT NULL,  -- Tax year this W2 covers
    EMPLOYER     CHAR(10)   NOT NULL,  -- Employer EIN — FK → TAXPAYER (as an employer)
    SEQ1         INT,                  -- Sequence number to distinguish multiple W2s from same employer
    TOTALWAGES   MONEY,                -- Total gross wages reported on the W2
    ASRESIDENT   MONEY,                -- Portion of wages earned while employee was a resident
    NONRESIDENT  MONEY,                -- Portion of wages earned while employee was a non-resident
    WITHHOLDINGS MONEY,                -- City income tax withheld from this employee
    TOTALDAYS    INT,                  -- Total days worked in the year
    CITYDAYS     INT,                  -- Days worked specifically within the city limits
    W3POST       DATETIME,             -- Date the employer's W3 was posted (sets the benchmark)
    RETPOST      DATETIME,             -- Date the employee's return was posted (reconciliation point)
    JS           CHAR(1),              -- J=Joint filer, S=Separate filer (for married couples)
    WSTATUS      CHAR(2),              -- W2 processing status code
    CITYID       INT,                  -- FK → INSOURCECITY — city jurisdiction for this W2
    OTHERCITY    CHAR(6),              -- Code for other city where taxes were also paid (for credit)
    OTHERWITH    MONEY,                -- Withholding paid to the other city (supports credit calculation)
    TRWAGES      MONEY,                -- Taxable resident wages — the actual base used for Dublin tax
    TRWITH       MONEY,                -- Taxable resident withholding — what counts toward Dublin liability
    REFUNDS      MONEY,                -- Refund amount associated with this W2 record
    FEDWAGES     MONEY,                -- Federal wages from W2 Box 1
    SSWAGES      MONEY,                -- Social Security wages from W2 Box 3
    MEDWAGES     MONEY,                -- Medicare wages from W2 Box 5
    LOCWAGES     MONEY,                -- Local wages as reported in the local wages box
    DEFERRED     MONEY,                -- Deferred compensation (401k, etc.) excluded from taxable wages
    CREDIT       MONEY,                -- Credit amount applied from other city taxes
    W2WAGES      MONEY,                -- Wages as reported directly on the W2 form
    W2WITHHOLDING MONEY,               -- Withholding as reported directly on the W2 form
    FEIN         CHAR(10),             -- Employer FEIN (can differ from EMPLOYER field in some edge cases)
    SOURCE       CHAR(4),              -- How this W2 arrived: tape, manual entry, web upload, etc.
    CREATEDATE   DATETIME,             -- Date this CITWAGE record was created
    STARTDATE    DATETIME,             -- Start of the employment period covered
    ENDDATE      DATETIME              -- End of the employment period covered
);
```

---

### W2ACTIVITY

Every action taken on a W2 record — correction, amendment, status change, manual adjustment — is logged here. With 2.5 million rows, this table is nearly as large as CITWAGE itself, which gives a sense of how frequently W2 records are touched after initial posting. The ACTIVITYTYPE column classifies the event, and ACTIVITYUSER records who did it.

```sql
CREATE TABLE W2ACTIVITY (
    TAXID             CHAR(10),    -- Employee SSN — FK → TAXPAYER
    TAXYEAR           CHAR(4),     -- Tax year
    EMPLOYER          CHAR(10),    -- Employer EIN — FK → TAXPAYER
    ACTIVITYDATE      DATETIME,    -- When this activity event occurred
    WAGES             MONEY,       -- Wage amount at the time of this activity (snapshot)
    WITHHOLDING       MONEY,       -- Withholding amount at the time of this activity (snapshot)
    ACTIVITYTYPE      CHAR(4),     -- Code describing what type of action was taken
    CITYID            INT,         -- FK → INSOURCECITY
    ACTIVITYUSER      CHAR(10),    -- Short ID of the user who performed the action
    COMMENT           VARCHAR(200),-- Free-text note explaining the activity
    BATCHID           INT,         -- FK → RETURNBATCH or WHBATCH — batch context for this action
    SEQ               INT,         -- Sequence within the W2 record
    LOCALENTITY       CHAR(6),     -- Local entity code at time of activity
    TRANSACTIONNUMBER CHAR(20),    -- Links to the corresponding transaction record
    WSTATUS           CHAR(2)      -- W2 status at the time of this activity
);
```

---

### W2CITIES

When an employee works for an employer that operates in multiple cities, the W2 may report earnings allocated to several jurisdictions. W2CITIES holds one row per city per W2, capturing the wages and withholding attributed to each jurisdiction separately. This enables the system to correctly calculate credits for taxes paid to other cities.

```sql
CREATE TABLE W2CITIES (
    TAXID       CHAR(10),    -- Employee SSN — FK → TAXPAYER
    TAXYEAR     CHAR(4),     -- Tax year
    EMPLOYER    CHAR(10),    -- Employer EIN
    SEQ1        INT,         -- W2 sequence — links back to the specific CITWAGE row
    CITYID      INT,         -- FK → INSOURCECITY — the jurisdiction this row covers
    CITYNAME    CHAR(30),    -- Name of the city (denormalized for display)
    LOCALWAGES  MONEY,       -- Wages attributable to this city
    LOCALWITH   MONEY,       -- Tax withheld for this city
    LOCALCODE   CHAR(6),     -- City tax code
    STATECODE   CHAR(2),     -- State abbreviation for this jurisdiction
    STATEWAGES  MONEY,       -- State wages for this city's state
    STATEWITH   MONEY        -- State withholding for this city's state
);
```

---

### BATCHW2s

A staging table for W2 records being imported as part of a return batch. Records land here during the import process and are moved to CITWAGE once they pass validation and the batch is finalized. The structure mirrors CITWAGE but includes the BATCHID and BATCHSEQ fields to track position within the staging batch.

```sql
CREATE TABLE BATCHW2S (
    BATCHID     INT,       -- FK → WHBATCH — which processing batch this record is staging in
    TAXID       CHAR(10),  -- Employee SSN
    TAXYEAR     CHAR(4),   -- Tax year
    EMPLOYER    CHAR(10),  -- Employer EIN
    WAGES       MONEY,     -- Wages from the staged W2
    WITHHOLDING MONEY,     -- Withholding from the staged W2
    CITYID      INT,       -- FK → INSOURCECITY
    BATCHSEQ    INT,       -- Sequence number of this record within the batch
    SOURCE      CHAR(4)    -- Source indicator for the incoming data
);
```

---

### SUSPW2CITIES

City-level W2 records held in suspension while errors on the parent W2 are being resolved. The structure mirrors W2CITIES exactly. Once the associated errors are cleared, these records are posted to W2CITIES and removed from suspension.

---

## 6. Individual & Business Tax Returns

A tax return is the formal document a taxpayer files to calculate their annual income tax liability, reconcile it against withholdings and estimated payments, and arrive at either a balance due or a refund. In Dublin, both individual residents and business entities file returns. Individual returns report wages (from W-2s), business income, investment income, and various credits. Business returns may also carry net operating losses forward into future years to offset future taxable income.

Returns go through a multi-stage process: they arrive (by mail, electronically, or as part of a bulk batch from a tax preparation service), are validated against a set of rules, are held in suspension if errors are found, and are posted to the permanent record once clean. The tables in this section cover the full lifecycle from submission to archival.

### CITMSTR

CITMSTR is the master tax return record — the official, posted version of every individual and business tax return filed with Dublin. One row exists per taxpayer per city per year. The column list reads like a tax form: wages, credits, deductions, tax due, penalty, interest, balance. The CURRENTBALANCE column represents where things stand right now, accounting for all payments and adjustments since filing. The RETPOSTFLG column distinguishes returns that have been officially posted from those still in process.

```sql
CREATE TABLE CITMSTR (
    TAXID          CHAR(10)   NOT NULL,  -- FK → TAXPAYER — who filed this return
    TAXYEAR        CHAR(4)    NOT NULL,  -- Tax year this return covers
    STAXID         CHAR(10),             -- Spouse's TAXID for jointly filed returns
    ACCOUNTID      INT,                  -- FK → ACCOUNTS — the account this return is filed under
    CITYID         INT,                  -- FK → INSOURCECITY — which city jurisdiction
    WAGES          MONEY,                -- Total wages reported on the return
    WITHHOLDINGS   MONEY,                -- Total city tax withheld (from W2s)
    ADDITIONS      MONEY,                -- Income additions (business income, other taxable income)
    SUBTRACTIONS   MONEY,                -- Income subtractions (allowable deductions)
    TAXDUE         MONEY,                -- Computed tax liability for the year
    CREDITS        MONEY,                -- Credits applied (other city taxes, prior year overpayments)
    PREVYRCR       MONEY,                -- Credit carried forward from a prior year's overpayment
    RETPYMT        MONEY,                -- Payment submitted with the return
    INTEREST       MONEY,                -- Interest charged on late payment or underpayment
    PENALTY        MONEY,                -- Penalty charged (late filing, late payment, estimated underpayment)
    REFUNDAMT      MONEY,                -- Refund amount due at time of filing
    BALANCEDUE     MONEY,                -- Balance due at time of filing
    CURRENTBALANCE MONEY,                -- Current outstanding balance (updated as payments/adjustments occur)
    FILEDUEDATE    DATETIME,             -- Statutory due date for this return
    RETPOSTFLG     CHAR(1),              -- P=Posted to permanent record, N=Not yet posted
    RETDATE        DATETIME,             -- Date the return was received or filed
    FILETYPE       CHAR(1),              -- R=Resident, N=Non-resident, B=Business
    RECSTATUS      CHAR(1),              -- A=Active, D=Deleted
    AMENDED        CHAR(1),              -- Y if this is an amended return superseding a prior filing
    AUDITORID      INT,                  -- FK → AUDITORS — auditor assigned to review this return
    BANKRUPT       CHAR(1),              -- Y if taxpayer is in bankruptcy proceedings
    PROGRAMCODE    CHAR(4),              -- Tax program classification code
    NOL            MONEY,                -- Net operating loss for this year (businesses)
    NOLCF          MONEY,                -- Net operating loss carried forward from prior years
    BATCHID        INT,                  -- FK → RETURNBATCH — the batch this return was processed in
    RETMEMO        TEXT                  -- Staff notes on this return
);
```

---

### LINEDET

LINEDET stores every individual line item from every tax form. A single return can generate dozens of line items — one for each line on each form and schedule. This table is what allows the system to reconstruct a return's full calculation from scratch and to display a detailed breakdown of how the total was computed. The FORMID and LINENUMBER columns together identify the exact position on the tax form. LINECODE links to the LINESCD table, which defines what each line is supposed to contain and how it is calculated.

```sql
CREATE TABLE LINEDET (
    TAXID       CHAR(10),    -- FK → CITMSTR — the return this line belongs to
    TAXYEAR     CHAR(4),     -- Tax year
    FORMID      INT,         -- FK → TAXFORM — which form this line is on
    LINENUMBER  CHAR(10),    -- The line number label as it appears on the printed form
    LINECODE    CHAR(10),    -- FK → LINESCD — code identifying the purpose of this line
    LINETYPE    CHAR(1),     -- C=Calculated by the system, M=Manually entered by staff
    AMOUNT      MONEY,       -- Dollar amount entered on this line
    AMOUNTV     FLOAT,       -- Validated/computed amount (may differ from entered amount during review)
    LINEERROR   CHAR(1),     -- Y if this line has a validation error
    CITYID      INT,         -- FK → INSOURCECITY
    COMMENT     VARCHAR(200) -- Staff note on this specific line item
);
```

---

### AMENDLINEDET

When a return is amended, the corrected line values are stored here alongside the original LINEDET rows. Each amended line is paired with its original via SEQUENCEID, allowing the system to show exactly what changed between the original filing and the amendment. There are roughly 53,000 amended line items, reflecting the volume of corrected returns in the history.

---

### SUSPRETURNS

Returns that fail validation are held here rather than being posted to CITMSTR. SUSPRETURNS has the same 120-column structure as CITMSTR — it is effectively a holding pen. The table is currently empty, which means all pending returns have either been resolved and posted or remain in CITMSTR proper. When a new batch of returns arrives with errors, rows will appear here until staff resolve the issues.

---

### SUSPLINEDET / SUSPTRERRORS

Line detail and validation errors for suspended returns mirror the LINEDET and TRERRORS structures but live in these separate suspension-specific tables. Once a return's errors are resolved, its suspension records are cleared and the data is promoted to CITMSTR and LINEDET.

---

### TRHIST

TRHIST is the permanent archive of returns as they appeared at specific points in time — a snapshot of the return record for audit purposes. When a return is amended or undergoes a significant change, the prior state is captured here. This table preserves the cases where explicit archival snapshots were required.

---

## 7. Return Validation & Error Handling

No return is perfect. Data entry errors, mismatched W2 figures, calculation mistakes, and missing schedules are a routine part of tax administration. The validation system catches these issues automatically as returns are processed and creates error records that must be reviewed and resolved before a return can be posted. Some errors block posting entirely; others are warnings that allow processing to continue but flag the return for secondary review.

The error system operates at two levels: active errors on returns currently being processed (TRERRORS), and a permanent history of all errors that have ever been raised (TRERRORHISTORY). The form definition tables — TAXFORM, TAXFORMPARTS, LINESCD, and FORMRULES — define exactly what each line of each form is supposed to contain and what rules apply.

### TRERRORS

Active validation errors on returns. Each row describes a specific error on a specific return: what went wrong, how severe it is, and when it was first detected. The ESTATUS field controls how the error affects processing: E (error) stops posting, W (warning) allows posting with a flag, and D (downgrade) reduces an error to a warning after manual review.

```sql
CREATE TABLE TRERRORS (
    TAXID        CHAR(10),    -- FK → CITMSTR — the return this error is on
    TAXYEAR      CHAR(4),     -- Tax year
    ERRORCODE    CHAR(10),    -- FK → TREINIT — the specific error type code
    ERRORTYPE    CHAR(4),     -- Classification of the error (TR=Tax Return, W3=Withholding, etc.)
    ESTATUS      CHAR(1),     -- E=Error (blocks posting), W=Warning, D=Downgraded to warning
    DESCRIPTION  CHAR(80),    -- Short human-readable label for the error
    EPARAGRAPH1  VARCHAR(500),-- Full error message text, paragraph 1
    EPARAGRAPH2  VARCHAR(500),-- Full error message text, paragraph 2
    EPARAGRAPH3  VARCHAR(500),-- Full error message text, paragraph 3
    EPARAGRAPH4  VARCHAR(500),-- Full error message text, paragraph 4
    DATEADDED    DATETIME,    -- When this error was first detected
    CITYID       INT          -- FK → INSOURCECITY
);
```

---

### TRERRORHISTORY

A permanent log of every error ever raised, including those that have been resolved. When an error is corrected and cleared from TRERRORS, a record is written here. This table allows auditors to see the full correction history of a return — what was wrong, when it was fixed, and by whom.

---

### TREINIT

The error code definition table — the master list of every possible error the validation system can raise. Each code has a description, a default severity, and standard message text. Administrators add new error codes here when new validation rules are added to the system.

---

### TAXFORM + TAXFORMPARTS + LINESCD + FORMRULES

These four tables define the structure of every tax form in the system. TAXFORM identifies the form itself (the annual individual return, the business return, estimated payment schedules, etc.). TAXFORMPARTS breaks each form into logical sections. LINESCD defines every individual line on every form — its label, its type, and whether it is calculated or entered. FORMRULES defines the calculation formulas and cross-references that govern how lines relate to each other. Together, these tables allow the validation engine to know what every number on every form should be and to flag deviations.

---

## 8. Batch Processing Pipeline

Returns and W2 data do not enter the system one record at a time — they arrive in bulk. Tax preparation companies submit files containing hundreds of returns. Employers submit tape files with thousands of W2 records. Even paper returns processed by staff are grouped into batches for efficient workflow management. The batch processing pipeline is the infrastructure that manages this bulk ingestion: it groups records, tracks their progress through validation, stages them until they are clean, and controls the final posting to permanent tables.

### RETURNBATCH

RETURNBATCH is the batch header for groups of tax returns. Every batch has a status that moves from Processing to Finalized as the records within it are validated and posted. The WAGETOTAL and WITHTOTAL columns let staff verify that the totals in the batch match what was expected from the source file. The SOURCE field identifies where the batch came from (paper, electronic, web portal, etc.).

```sql
CREATE TABLE RETURNBATCH (
    BATCHID      INT          NOT NULL,  -- Primary key — unique identifier for this batch
    USERSHORTID  CHAR(10),               -- Short login ID of the user who created the batch
    CREATEDATE   DATETIME,               -- When the batch was opened
    BATCHSTATUS  CHAR(1),                -- F=Finalized (all records posted), P=Processing (still active)
    WAGETOTAL    MONEY,                  -- Expected total wages across all returns in this batch
    WITHTOTAL    MONEY,                  -- Expected total withholdings across all returns in this batch
    CALCDATE     DATETIME,               -- Date the batch's calculations were run
    DESCRIPTION  VARCHAR(200),           -- Human-readable description of what this batch contains
    SOURCE       CHAR(4),                -- Source indicator (paper, tape, web, EFT, etc.)
    SPECIALTYPE  CHAR(4)                 -- Special processing flag for non-standard batch types
);
```

---

### BATCHRETURNS + BATCHLINEDET

During the staging phase, individual return records and their line details sit in BATCHRETURNS and BATCHLINEDET rather than in CITMSTR and LINEDET. This separation ensures that invalid or unreviewed returns never pollute the official record. Once a batch is finalized, valid records are moved to permanent tables and the staging rows are cleared.

---

### RETURNTRACKING

The action audit trail for every return through its entire lifecycle. Every status change, every error resolution, every batch assignment generates a RETURNTRACKING record. With 1.8 million rows this is one of the most detailed audit logs in the system — it can reconstruct the complete processing history of any return from the moment it was first received to the moment it was posted.

---

### IMPORTTRACKING

A log of every file imported into the system: who uploaded it, when, how many records it contained, how many succeeded, and how many failed. This table is the starting point for diagnosing import problems — if a batch is missing records, IMPORTTRACKING shows whether they failed during import or were never in the file.

---

### IMPORTEXCEPTIONS

Records that failed import validation before even reaching the staging tables. These represent the most fundamental failures — records the system could not parse or that violated basic structural rules. Each exception records the error code and message, the position in the file where the failure occurred, and the raw data that caused the problem.

---

### FILESEGMENTS

Large files are split into chunks for storage and processing. FILESEGMENTS stores those chunks with sequence numbers that allow the original file to be reconstructed. This handles the practical reality that tax season submissions can be very large files that exceed practical single-write limits.

---

## 9. Payments & Cash Flow In

Money flows into the Dublin tax system from two primary sources: employers making periodic withholding remittances throughout the year, and individual taxpayers paying balances due with their returns or in response to assessments and notices. Every dollar that comes in — regardless of source, method, or timing — is recorded as a receipt. The payment system is designed around daily cashier workflow: a clerk opens a batch, processes a day's worth of payments, closes the batch, and it rolls up into a bank deposit.

The TRANSACTIONS table is the unified financial ledger that reflects every monetary event: a receipt creates a transaction, a refund creates a transaction, an assessment creates a transaction. TRANSHST is the audit trail of every change to every transaction.

### RECEIPTS

Every payment received is a receipt. The 2.3 million rows in this table represent the complete inbound payment history of the tax system. The key fields are: who paid (TAXID), what year it is for (TAXYEAR), how much was paid broken down by component (TAXPAID, PENALTYPAID, INTERESTPAID), how it was paid (PYMETHOD), and what batch it was processed in (BATCHID). NSF flags mark bounced checks. RSTATUS distinguishes active receipts from voided ones.

```sql
CREATE TABLE RECEIPTS (
    RCTNO              CHAR(20)   NOT NULL,  -- Receipt number — the primary identifier for this payment
    RCTDATE            DATETIME,             -- Date the payment was received
    TAXID              CHAR(10),             -- FK → TAXPAYER — who made the payment
    TAXYEAR            CHAR(4),              -- Tax year this payment is applied to
    TAXPAID            MONEY,                -- Tax component of the payment
    PENALTYPAID        MONEY,                -- Penalty component of the payment
    INTERESTPAID       MONEY,                -- Interest component of the payment
    OTHERPAID          MONEY,                -- Other fees or miscellaneous amounts paid
    PYMETHOD           CHAR(4),             -- FK → PYMETHCD — how it was paid (check, cash, EFT, etc.)
    REF                VARCHAR(40),          -- Check number, wire reference, or other payment reference
    RECEIVEDFROM       VARCHAR(60),          -- Name of the person or entity that submitted the payment
    POSTDATE           DATETIME,             -- Accounting post date (may differ from receipt date)
    NSF                CHAR(1),              -- Y if the check bounced (Non-Sufficient Funds)
    BATCHID            INT,                  -- FK → PAYBATCH — the cashier batch this payment was processed in
    ACCOUNTID          INT,                  -- FK → ACCOUNTS — which account this payment is applied to
    TRANSACTIONNUMBER  VARCHAR(40),          -- Links to the corresponding TRANSACTIONS record
    RSTATUS            CHAR(1),              -- A=Active, V=Voided
    EFTDATE            DATETIME,             -- Date an EFT payment was processed by the bank
    MIXEDDETAIL        VARCHAR(200)          -- JSON or delimited allocation for multi-year payments
);
```

---

### CITPAY

CITPAY is the city-level decomposition of each receipt. When a taxpayer makes a payment that covers obligations in multiple jurisdictions or tax types, CITPAY breaks it down to the city and tax code level. The row count matches RECEIPTS almost exactly, with one CITPAY row per receipt in most cases and multiple rows when a payment spans jurisdictions.

```sql
CREATE TABLE CITPAY (
    RCTNO       CHAR(20),  -- FK → RECEIPTS — the parent receipt this city allocation belongs to
    DATE_PAID   DATETIME,  -- Date the payment was made
    TAXID       CHAR(10),  -- FK → TAXPAYER
    TAXYEAR     CHAR(4),   -- Tax year this portion of the payment covers
    PTAXCODE    CHAR(4),   -- Tax code identifying the type of tax this payment covers
    TAX_PAID    MONEY,     -- Tax component allocated to this city
    PENALTY_PD  MONEY,     -- Penalty component allocated to this city
    INTEREST_PD MONEY,     -- Interest component allocated to this city
    OTHERPAID   MONEY,     -- Other fees allocated to this city
    POST_DATE   DATETIME,  -- Post date for accounting purposes
    CITYID      INT,       -- FK → INSOURCECITY — the city receiving this allocation
    NSF         CHAR(1),   -- Y if associated receipt bounced
    ACCOUNTID   INT,       -- FK → ACCOUNTS
    PSTATUS     CHAR(1)    -- Payment status for this city allocation
);
```

---

### PAYBATCH

Payment batches group receipts processed on the same day by the same cashier. A batch is opened at the start of a processing session, all payments are entered into it, and it is closed and balanced before being linked to a bank deposit. The TOTAL1 through TOTAL10 columns allow detailed breakdowns by payment type (cash, check, card, EFT, etc.) for daily balancing purposes.

```sql
CREATE TABLE PAYBATCH (
    BATCHID      INT          NOT NULL,  -- Primary key — unique batch identifier
    USERSHORTID  CHAR(10),               -- Short ID of the cashier who processed this batch
    CREATEDATE   DATETIME,               -- When the batch was opened
    BATCHSTATUS  CHAR(1),                -- A=Open (still accepting payments), C=Closed
    PAYTOTAL     MONEY,                  -- Total dollar amount of all payments in this batch
    DEPOSITID    INT,                    -- FK → DEPOSITS — which bank deposit this batch rolled into
    DEPOSITDATE  DATETIME,               -- Date the batch was deposited to the bank
    DESCRIPTION  VARCHAR(200),           -- Batch description
    BATCHCODE    CHAR(4),                -- Classification code for the batch type
    TOTAL1       MONEY,                  -- Cash total in this batch
    TOTAL2       MONEY,                  -- Check total in this batch
    TOTAL3       MONEY,                  -- Credit card total in this batch
    TOTAL4       MONEY,                  -- EFT total in this batch
    TOTAL5       MONEY,                  -- Additional payment category total
    TOTAL6       MONEY,                  -- Additional payment category total
    TOTAL7       MONEY,                  -- Additional payment category total
    TOTAL8       MONEY,                  -- Additional payment category total
    TOTAL9       MONEY,                  -- Additional payment category total
    TOTAL10      MONEY,                  -- Additional payment category total
    COUNT1       INT,                    -- Count of items in category 1
    COUNT2       INT,                    -- Count of items in category 2
    COUNT3       INT,                    -- Count of items in category 3
    COUNT4       INT                     -- Count of items in category 4
);
```

---

### DEPOSITS

Bank deposits are the physical act of taking a day's collected payments to the bank. Each deposit record links to the payment batches it contains and reconciles against the actual bank credit.

```sql
CREATE TABLE DEPOSITS (
    DEPOSITID         INT       NOT NULL,  -- Primary key — unique deposit identifier
    DATECREATED       DATETIME,            -- Date the deposit record was created in the system
    DATEDEPOSITED     DATETIME,            -- Date the physical deposit was taken to the bank
    TOTALAMOUNT       MONEY,               -- Total amount of the deposit as calculated by the system
    TOTALCASH         MONEY,               -- Cash component of the deposit
    TOTALCHECKS       MONEY,               -- Check component of the deposit
    TOTALCHARGE       MONEY,               -- Credit card / charge component of the deposit
    BANKDEPOSITAMOUNT MONEY,               -- Actual amount credited by the bank (for reconciliation)
    CLEAREDFLAG       CHAR(1),             -- Y if the bank has confirmed this deposit cleared
    CLEAREDDATE       DATETIME             -- Date the bank confirmed clearance
);
```

---

### PYMETHCD

The payment method code lookup table defines the valid codes for how a payment was made. Used everywhere a payment method appears.

```sql
CREATE TABLE PYMETHCD (
    PYMETHOD     CHAR(4),      -- Payment method code (CH, CA, EFT, CC, MO, etc.)
    DESCRIPTION  VARCHAR(40)   -- Human-readable description of the payment method
);
```

Valid codes include: CH (Check), CA (Cash), EFT (Electronic Funds Transfer), CC (Credit Card), MO (Money Order), and several additional electronic and agency-specific codes.

---

### TRANSACTIONS

TRANSACTIONS is the unified financial event ledger — every assessment, payment, credit, refund, adjustment, and fee appears here as a signed transaction. At 3.5 million rows it is the backbone of the financial subsystem. Each row represents a discrete monetary event: the TRANSTYPE column classifies it, the AMOUNT is signed (positive for charges, negative for credits and payments in many implementations), and the BALANCE column shows the running account balance immediately after this event. This is the table to query when you need to reconstruct the full financial history of any account.

```sql
CREATE TABLE TRANSACTIONS (
    TRANSID    INT       NOT NULL,  -- Primary key — unique identifier for this financial event
    TRANSDATE  DATETIME,            -- Date the event occurred
    TAXID      CHAR(10),            -- FK → TAXPAYER — whose account this event affects
    TAXYEAR    CHAR(4),             -- Tax year this event relates to
    ACCOUNTID  INT,                 -- FK → ACCOUNTS — which account this event is posted to
    TRANSTYPE  CHAR(6),             -- Event type code (PYMT=payment, ASMT=assessment, RFND=refund, etc.)
    AMOUNT     MONEY,               -- Total amount of this event (signed)
    PENALTY    MONEY,               -- Penalty component of this event
    INTEREST   MONEY,               -- Interest component of this event
    OTHER      MONEY,               -- Other fees component of this event
    BALANCE    MONEY,               -- Account balance immediately after this event
    USERID     CHAR(10),            -- FK → USERID — user who created or approved this transaction
    COMMENT    VARCHAR(200),        -- Notes explaining the transaction
    BATCHID    INT,                 -- Batch reference for grouped transactions
    CITYID     INT                  -- FK → INSOURCECITY — jurisdiction
);
```

---

### TRANSHST

The largest table in the system at 4.7 million rows, TRANSHST is the audit trail of every change to every transaction. When a transaction is voided, corrected, or has its status changed, TRANSHST captures the before-state: who made the change, when, from which screen or function, and what the status was before the change. This is the definitive audit record for financial disputes.

```sql
CREATE TABLE TRANSHST (
    TAXID             CHAR(10),    -- FK → TAXPAYER — whose account
    TAXYEAR           CHAR(4),     -- Tax year
    QDATE             DATETIME,    -- Exact timestamp when the change was made
    QUSER             CHAR(10),    -- Short ID of the user who made the change
    QFUNC             CHAR(10),    -- Code for the function or screen that initiated the change
    QSTATUS           CHAR(4),     -- Status of the transaction before this change
    TRANSACTIONNUMBER CHAR(20),    -- Links back to the specific transaction that was changed
    COMMENT           VARCHAR(200) -- Notes on why the change was made
);
```

---

## 10. Refunds & Credits

When a taxpayer has paid more than they owe — through over-withholding, an amended return, or a successful appeal — the city owes them money back. Refunds are outbound payments: the system generates a check record, the check is printed and mailed, and the system tracks whether the check has been cashed. Not all overpayments result in a refund check; a taxpayer may instead elect to carry the overpayment forward as a credit against the following year's obligation, which is handled through the CREDITS table.

### REFUNDS

Every outbound refund check issued to a taxpayer. The lifecycle of a refund is tracked through three dates: DATEPOSTED (when the refund was recorded), DATEISSUED (when the check was generated and mailed), and DATE_CLEARED (when the taxpayer cashed the check). The CLEAREDFLAG indicates whether the check has been cashed. Uncashed checks eventually age into outstanding liabilities. Voided checks (RSTATUS=V) appear here as well, allowing the replacement check history to be traced.

```sql
CREATE TABLE REFUNDS (
    TRANSACTIONNUMBER  VARCHAR(40)  NOT NULL,  -- Primary key — transaction number for this refund
    TAXID              CHAR(10),               -- FK → TAXPAYER — who is receiving the refund
    TAXYEAR            CHAR(4),                -- Tax year the refund is for
    AMOUNT             MONEY,                  -- Principal refund amount
    INTERESTPAID       MONEY,                  -- Interest paid on the refund (if applicable)
    CHECKNUMBER        INT,                    -- Physical check number printed on the check
    DATEPOSTED         DATETIME,               -- Date the refund was entered and approved in the system
    DATEISSUED         DATETIME,               -- Date the check was generated and mailed
    DATE_CLEARED       DATETIME,               -- Date the taxpayer cashed the check
    CLEAREDFLAG        CHAR(1),                -- Y=Check has been cashed; N=Still outstanding
    PAID_TO            VARCHAR(60),            -- Name printed on the check (payee)
    RSTATUS            CHAR(1),                -- A=Active, V=Voided
    REFUNDTYPE         CHAR(2),                -- R=Normal refund, V=Voided refund
    REASON             CHAR(4),                -- FK → REFUNDREASON — why this refund was issued
    BATCHID            INT,                    -- FK → REFUNDBATCH — the check-run batch this was part of
    CITYID             INT,                    -- FK → INSOURCECITY — which city issued this refund
    THIRDPARTY         CHAR(1),                -- Y if the check was made out to a third party (e.g., tax preparer)
    FORWARDFLAG        CHAR(1),                -- Y if overpayment was forwarded to next year rather than refunded
    REFUNDID           INT,                    -- FK → CREDITS — linked credit record if amount carried forward
    ACCOUNTID          INT,                    -- FK → ACCOUNTS
    REFUNDNOTE         VARCHAR(200)            -- Staff notes on this specific refund
);
```

---

### REFUNDBATCH

Refunds are not issued individually — they are processed in check runs, where the system generates a batch of checks for all pending refunds above a certain threshold. Each check run is a REFUNDBATCH record, tracking the batch total and count for reconciliation against the physical checks produced.

```sql
CREATE TABLE REFUNDBATCH (
    BATCHID      INT       NOT NULL,  -- Primary key — unique identifier for this check run
    USERSHORTID  CHAR(10),            -- Short ID of the user who initiated the check run
    CREATEDATE   DATETIME,            -- Date the check run was initiated
    BATCHSTATUS  CHAR(1),             -- Status of the batch (processing, issued, cleared, etc.)
    REFUNDTOTAL  MONEY,               -- Total dollar amount of all refunds in this batch
    REFUNDCOUNT  INT                  -- Number of individual refund checks in this batch
);
```

---

### CREDITS

Credits represent overpayments that have been applied to a future year rather than refunded. A taxpayer who overpaid in the current year may elect to carry that overpayment forward, and this table records the transfer: the source taxpayer, source year, destination year, and amount. Credits can also arise from inter-account offsets when a taxpayer owes in one jurisdiction and has a surplus in another.

```sql
CREATE TABLE CREDITS (
    TAXID         CHAR(10),  -- FK → TAXPAYER — who is receiving the credit
    TAXYEAR       CHAR(4),   -- Tax year the credit is being applied to
    FROMTAXID     CHAR(10),  -- Source taxpayer (often same as TAXID; different for offsets)
    FROMYEAR      CHAR(4),   -- Tax year the overpayment originated from
    AMOUNT        MONEY,     -- Credit amount being carried or applied
    CREDITTYPE    CHAR(2),   -- R=Credit from refund basis, O=Offset from another account
    EFFECTIVEDATE DATETIME,  -- Date the credit became effective
    REFUNDID      INT,       -- FK → REFUNDS — linked refund record if credit originated from a refund
    CITYID        INT,       -- FK → INSOURCECITY — city receiving the credit
    FROMCITYID    INT        -- City the credit originated from (for cross-jurisdiction offsets)
);
```

---

### REFUNDCD + REFUNDREASON

Two small lookup tables. REFUNDCD categorizes the type of refund at a high level. REFUNDREASON provides the specific reason codes used in the REFUNDS.REASON field — why the refund was issued (e.g., overpayment on return, amended return, appeal settlement, duplicate payment).

---

## 11. Assessments, Adjustments & Interest

An assessment is a formal statement from the city that a taxpayer owes a specific amount of tax, penalty, and interest. Assessments are created when a return is filed and shows a balance due, when an employer's W3 reconciliation reveals underpayment, or when an audit discovers unreported income. An assessment gives the city a documented liability that can be collected, negotiated into a payment plan, or discharged through bankruptcy.

Adjustments are the manual corrections that auditors and staff apply to an account — upward to add a charge or downward to waive a penalty or settle a dispute. The INTEREST table provides the daily rate schedule used to compute interest charges over time.

### ASSESSMENTS

The initial charge creation. Every assessment records what was owed, the period it covers, and the type of tax obligation it relates to. The ASSESSTYPE field distinguishes annual assessments (from a return), quarterly assessments (from periodic withholding obligations), and withholding assessments (from W3 reconciliation). ASSESSPERIOD identifies which quarter or month within the year the assessment covers for periodic filers.

```sql
CREATE TABLE ASSESSMENTS (
    TAXID         CHAR(10)   NOT NULL,  -- FK → TAXPAYER — who owes this assessment
    TAXYEAR       CHAR(4)    NOT NULL,  -- Tax year this assessment is for
    ASSESSDATE    DATETIME,             -- Date the assessment was created
    AMOUNT        MONEY,                -- Tax amount assessed (not including penalty and interest)
    PENALTY       MONEY,                -- Penalty amount assessed
    INTEREST      MONEY,                -- Interest amount assessed at time of creation
    OTHER         MONEY,                -- Other charges included in this assessment
    ASSESSTYPE    CHAR(1),              -- A=Annual, Q=Quarterly, W=Withholding
    ASSESSPERIOD  INT,                  -- For periodic assessments: quarter (1-4) or month (1-12)
    TAXPAYERTYPE  CHAR(1),              -- W=Withholding employer, I=Individual, B=Business
    WAGES         MONEY,                -- Wage base used to calculate withholding assessments
    CITYID        INT,                  -- FK → INSOURCECITY — jurisdiction
    MAXPENALTY    NUMERIC(5,2)          -- Maximum penalty percentage cap for this assessment
);
```

---

### ADJUSTMENTS

Manual corrections to tax liability. Adjustments can increase or decrease what a taxpayer owes, and the ADJUSTTYPES lookup table classifies every adjustment with a PLUSMINUS direction indicator. Common adjustment types include: Correction (fixing a data entry error), Penalty Waiver (administrative discretion), Amended Return (incorporating a filed amendment), and Write-off (uncollectable debt). Every adjustment is documented with a comment explaining the reason.

```sql
CREATE TABLE ADJUSTMENTS (
    TAXID       CHAR(10)    NOT NULL,  -- FK → TAXPAYER
    TAXYEAR     CHAR(4)     NOT NULL,  -- Tax year
    ADJUSTDATE  DATETIME,              -- Date the adjustment was made
    AMOUNT      MONEY,                 -- Total adjustment amount (positive or negative)
    TAX         MONEY,                 -- Tax component of the adjustment
    PENALTY     MONEY,                 -- Penalty component of the adjustment
    INTEREST    MONEY,                 -- Interest component of the adjustment
    ADJUSTTYPE  CHAR(6),               -- FK → ADJUSTTYPES — what kind of adjustment this is
    COMMENT     NVARCHAR(500),         -- Required explanation of why this adjustment was made
    BATCHID     INT,                   -- Batch reference if processed as part of a batch
    INVOICEID   INT,                   -- FK → INVOICES — linked invoice if applicable
    CITYID      INT                    -- FK → INSOURCECITY
);
```

---

### INTEREST

The interest rate schedule. Interest on late payments and underpayments accrues daily at rates set by the city or state for each period. This table defines the rate that was in effect for each date range — seven rows covering the system's history means the rate has changed seven times. The calculation engine uses this table to compute interest from the assessment date to the payment date for any historical period.

```sql
CREATE TABLE INTEREST (
    START_DATE           DATETIME     NOT NULL,  -- First date this interest rate is in effect
    END_DATE             DATETIME,               -- Last date this rate applies (null = currently active)
    DAILY_INTEREST_RATE  FLOAT,                  -- Primary daily interest rate (annual rate / 365)
    DAILY_INTEREST_RATE2 FLOAT,                  -- Secondary rate (used for different penalty tiers)
    DAILY_INTEREST_RATE3 FLOAT                   -- Tertiary rate (used for specific assessment types)
);
```

---

## 12. Payment Plans

When a taxpayer or employer cannot pay their full outstanding balance in one payment, they can enter into an installment agreement with the city. The tax office and the taxpayer agree on a total amount, a number of installments, a payment amount, and a payment frequency. The system maintains a full amortization schedule and tracks each payment against the plan. Only 107 active payment plans exist at this time, suggesting that most balances are resolved through standard collection rather than installment agreements.

### PAYPLANS

The plan header. One row per installment agreement, recording the top-level terms: total amount, number of payments, down payment, the day of month payments are due, and the current status of the plan. The TAXYEARS field records which tax years the plan covers.

```sql
CREATE TABLE PAYPLANS (
    PLANID       INT          NOT NULL,  -- Primary key — unique identifier for this payment plan
    TAXID        CHAR(10),               -- FK → TAXPAYER — who this plan is for
    TRANSACTIONNUMBER VARCHAR(40),       -- Transaction reference linking the plan to the financial ledger
    AMOUNT       MONEY,                  -- Total amount to be paid under this plan
    PPSTATUS     CHAR(1),                -- A=Active, C=Completed, D=Defaulted
    NUMBERPAYS   INT,                    -- Total number of installment payments in the plan
    DOWNPAY      MONEY,                  -- Down payment required at plan inception
    FINALPAY     MONEY,                  -- Final payment amount (may differ from regular installment)
    DUEDAY       INT,                    -- Day of the month each installment is due (e.g., 15 = 15th)
    NEXTDUEDATE  DATETIME,               -- Due date of the next installment payment
    CURRENTDUE   MONEY,                  -- Amount due in the current period
    CURRENTPAID  MONEY,                  -- Amount paid so far in the current period
    STARTTOTAL   MONEY,                  -- Total liability at the time the plan was entered into
    TAXYEARS     VARCHAR(100),           -- Delimited list of tax years included in this plan
    BASEDATE     DATETIME                -- Date the installment agreement was signed and became effective
);
```

---

### PAYPLANAMORT

The amortization schedule — one row per installment. Each row shows the due date for that payment, what balance remains on the plan by component (tax, penalty, interest, other), and what has been paid toward each component so far.

```sql
CREATE TABLE PAYPLANAMORT (
    PLANID   INT  NOT NULL,  -- FK → PAYPLANS — which plan this installment belongs to
    LINENUM  INT  NOT NULL,  -- Installment number (1 = first payment, 2 = second, etc.)
    PAYDATE  DATETIME,       -- Due date for this installment
    BALTAX   INT,            -- Remaining tax balance after this payment (in cents or as integer)
    BALPEN   INT,            -- Remaining penalty balance after this payment
    BALINT   INT,            -- Remaining interest balance after this payment
    BALOTH   INT,            -- Remaining other charges balance after this payment
    PDTAX    INT,            -- Tax amount paid in this installment
    PDPEN    INT,            -- Penalty amount paid in this installment
    PDINT    INT,            -- Interest amount paid in this installment
    PDOTH    INT             -- Other charges paid in this installment
);
```

---

### PAYPLANYEARS

Records which specific tax years are included in each plan and what the starting balance was for each year when the plan was created. A single payment plan often covers multiple years of back taxes.

```sql
CREATE TABLE PAYPLANYEARS (
    PLANID        INT       NOT NULL,  -- FK → PAYPLANS
    TAXYEAR       CHAR(4)   NOT NULL,  -- Tax year included in this plan
    TAXID         CHAR(10),            -- FK → TAXPAYER
    STARTTAX      MONEY,               -- Tax balance for this year at plan inception
    STARTPENALTY  MONEY,               -- Penalty balance for this year at plan inception
    STARTINTEREST MONEY,               -- Interest balance for this year at plan inception
    STARTTOTAL    MONEY                -- Total balance for this year at plan inception
);
```

---

## 13. 1099 & IRS Reporting

In addition to administering city income taxes, Dublin's tax office handles 1099 reporting — the IRS forms that document miscellaneous income paid to individuals who are not traditional employees. This includes payments to independent contractors, freelancers, and vendors. The city collects this data because non-employee income is taxable at the local level, and 1099 data helps identify under-reported income. The system also transmits summary data to the IRS and maintains reconciliation records to ensure city records align with federal submissions.

### G1099B

The primary 1099 data table, holding one row per recipient per payer per year. The BOX1 through BOX12 columns map directly to the boxes on the IRS 1099 form (MISC, NEC, INT, DIV, etc.). The FORM_TYPE column identifies which 1099 variant this record represents.

```sql
CREATE TABLE G1099B (
    TAXID         CHAR(10),    -- FK → TAXPAYER — the person receiving the 1099 income
    TAXYEAR       CHAR(4),     -- Tax year the income was paid
    EMPLOYER      CHAR(10),    -- FK → TAXPAYER — the payer (as an employer/business)
    SEQ           INT,         -- Sequence number to distinguish multiple 1099s from same payer
    TOTALPAYMENTS MONEY,       -- Total 1099 payments made to this recipient
    FEDERALWITH   MONEY,       -- Federal income tax withheld (backup withholding)
    STATEWITH     MONEY,       -- State income tax withheld
    LOCALWITH     MONEY,       -- Local income tax withheld
    BOX1          MONEY,       -- IRS Box 1 amount (varies by form type)
    BOX2          MONEY,       -- IRS Box 2 amount
    BOX3          MONEY,       -- IRS Box 3 amount
    BOX4          MONEY,       -- IRS Box 4 amount
    BOX5          MONEY,       -- IRS Box 5 amount
    BOX6          MONEY,       -- IRS Box 6 amount
    BOX7          MONEY,       -- IRS Box 7 amount
    BOX8          MONEY,       -- IRS Box 8 amount
    BOX9          MONEY,       -- IRS Box 9 amount
    BOX10         MONEY,       -- IRS Box 10 amount
    BOX11         MONEY,       -- IRS Box 11 amount
    BOX12         MONEY,       -- IRS Box 12 amount
    FORM_TYPE     CHAR(10),    -- The IRS form type: 1099-MISC, 1099-NEC, 1099-INT, 1099-DIV, etc.
    CITYID        INT,         -- FK → INSOURCECITY — jurisdiction
    SOURCE        CHAR(4),     -- How this record arrived: tape, manual, web, etc.
    CREATEDATE    DATETIME     -- When this record was created in the system
);
```

---

### G1099A

Records for IRS Form 1099-A (Acquisition or Abandonment of Secured Property). The very small row count reflects the relative rarity of this filing type in a municipal tax context.

---

### G1099T

Aggregated 1099 totals by payer and tax year — the summary-level view used for batch processing and transmittal preparation.

---

### G1099OPTIONS

Configuration table for 1099 processing behavior: minimum payment thresholds below which 1099s are not required, electronic filing settings, and form type routing rules.

---

### TR1099

Tracking records for 1099 transmittal files submitted to the IRS. Each row represents one submission event — a file sent on a specific date with a specific status.

```sql
CREATE TABLE TR1099 (
    TAXID        CHAR(10),    -- FK → TAXPAYER — the filing organization (Dublin city)
    TAXYEAR      CHAR(4),     -- Tax year covered by this transmittal
    TRANSMITDATE DATETIME,    -- Date the transmittal file was sent to the IRS
    TRSTATUS     CHAR(4),     -- Transmittal status (pending, accepted, rejected, etc.)
    FILENAME     VARCHAR(120),-- Name of the transmittal file submitted
    CITYID       INT          -- FK → INSOURCECITY — city that filed the transmittal
);
```

---

### IRSG* Tables (IRSG109905 through IRSG109912)

One table per IRS 1099 form series, these tables store the reconciliation data between what the city holds in G1099B and what was included in each IRS transmittal. When the IRS rejects or questions a submission, these tables allow staff to identify exactly which records were in each batch and what their status is.

---

## 14. Documents & Correspondence

Every notice mailed, every document scanned, every letter generated by the system is recorded in the documents and correspondence system. DOCHEADER serves as the central index with 1.3 million entries — an enormous volume reflecting decades of correspondence. Documents and letters are the primary means by which the tax office communicates with taxpayers: assessment notices, refund confirmations, audit requests, and payment plan agreements all flow through this system.

### DOCHEADER

The document index. Every document — whether scanned paper, a generated notice, or a system-produced letter — gets a DOCHEADER record as its index entry. This table is searched to find all documents associated with a taxpayer, filtered by year, type, or date. The actual document binary content lives in DOCUMENTS or an external storage system; DOCHEADER holds the metadata needed to find it.

```sql
CREATE TABLE DOCHEADER (
    TAXID             CHAR(10),    -- FK → TAXPAYER — which taxpayer this document belongs to
    TAXYEAR           CHAR(4),     -- Tax year this document pertains to
    DOCSEQ            INT,         -- Document sequence number (unique per taxpayer per year)
    DOCTYPE           CHAR(6),     -- Document type code (from DOCDBS lookup)
    DOCDATE           DATETIME,    -- Date of the document itself (vs. when it was indexed)
    DOCSTATUS         CHAR(2),     -- Status of the document (active, archived, void, etc.)
    CITYID            INT,         -- FK → INSOURCECITY — city context
    BATCHID           INT,         -- Batch reference if document was part of a bulk processing run
    DESCRIPTION       VARCHAR(200),-- Human-readable description of what this document is
    DOCID             INT,         -- FK → DOCUMENTS — links to the binary content record
    USERID            CHAR(10),    -- FK → USERID — who indexed or created this document
    TRANSACTIONNUMBER VARCHAR(40), -- Links to a specific transaction this document relates to
    CREATEDATE        DATETIME,    -- When this document was indexed into the system
    PAGES             INT,         -- Number of pages in this document
    STORAGEID         INT          -- Storage location identifier (for externally stored documents)
);
```

---

### DOCUMENTS

Designed to hold document images as binary blobs, this table is currently empty — documents are stored in an external system with DOCHEADER maintaining the index and pointer (via STORAGEID). The structure is preserved for potential future use.

```sql
CREATE TABLE DOCUMENTS (
    TAXID      CHAR(10),    -- FK → TAXPAYER
    TAXYEAR    CHAR(4),     -- Tax year
    DOCSEQ     INT,         -- Document sequence — matches DOCHEADER.DOCSEQ
    DOCDESC    VARCHAR(200),-- Document description
    DOCIMAGE   IMAGE,       -- Binary document content (scan, PDF, etc.)
    ANNOTATION IMAGE        -- Binary annotation overlay (highlights, notes added to the scan)
);
```

---

### LETTERS

Every notice or letter sent to a taxpayer. Where DOCHEADER is the index for any document, LETTERS specifically tracks generated correspondence — system-produced notices created from templates. The RESPONDBY and RECEIVED columns support tracking whether the taxpayer responded to a notice and when.

```sql
CREATE TABLE LETTERS (
    TAXID             CHAR(10),    -- FK → TAXPAYER — the recipient
    TAXYEAR           CHAR(4),     -- Tax year this letter pertains to
    LETTERDATE        DATETIME,    -- Date the letter was generated
    LETTERTYPE        CHAR(6),     -- FK → LTRTMPLT — which template was used
    LETTERSTATUS      CHAR(2),     -- Status of this letter (generated, mailed, responded, etc.)
    CITYID            INT,         -- FK → INSOURCECITY
    BATCHID           INT,         -- FK → DOCBATCH — the mailing batch this letter was part of
    AUDITORID         INT,         -- FK → AUDITORS — auditor who generated or is associated with this letter
    TRANSACTIONNUMBER VARCHAR(40), -- Links to the transaction this letter is about
    SUBJECT           VARCHAR(200),-- Subject line of the letter
    USERID            CHAR(10),    -- FK → USERID — who generated this letter
    CONTENT           TEXT,        -- Full body text of the letter
    PAGES             INT,         -- Number of pages
    MAILDATE          DATETIME,    -- Date the physical letter was mailed
    RESPONDBY         DATETIME,    -- Deadline by which the taxpayer must respond
    RECEIVED          DATETIME     -- Date the taxpayer's response was received
);
```

---

### LTRTMPLT

Letter templates with merge field placeholders. Staff select a template, the system merges in taxpayer-specific data (name, address, balance, tax year), and produces a letter ready for printing and mailing. The 16-column structure covers template identity, default subject and content, the letter type classification, and whether the template is currently active.

```sql
CREATE TABLE LTRTMPLT (
    TEMPLATEID    INT          NOT NULL,  -- Primary key — unique template identifier
    TEMPLATENAME  CHAR(40),               -- Internal name used to identify this template
    SUBJECT       VARCHAR(200),           -- Default subject line (may be overridden per letter)
    CONTENT       TEXT,                   -- Template body with merge field placeholders
    LETTERTYPE    CHAR(6),                -- Classification code for the type of letter
    ACTIVE        CHAR(1)                 -- Y=This template is currently in use; N=Retired
);
```

---

### DOCBATCH

Batch mailing and printing records that group multiple letters generated in the same processing run — typically notices generated for all taxpayers meeting a specific condition (e.g., all accounts with balances over a threshold as of a certain date).

---

### DOCDBS / DOCDESC

Document type reference tables. DOCDBS defines the valid DOCTYPE codes used in DOCHEADER, and DOCDESC provides extended descriptions for each document type.

---

## 15. Configuration & Reference Data

The configuration tables define the rules the system uses to compute taxes, validate returns, route processing, and communicate with taxpayers. Nothing in this section stores taxpayer data — it stores the parameters that govern how taxpayer data is processed. Changes to these tables affect system-wide behavior, so they are typically only modified by system administrators.

### YEARCONFIG

Per-year configuration for each tax year that has ever been active in the system. The DUEDATE determines when annual returns must be filed; ESTIMATEDUE governs estimated payment schedules. TAXRATE is the city's income tax rate for that year. MINFILING establishes the minimum income threshold below which no return is required. YEARSTATUS controls whether a year is currently open for filing or has been closed.

```sql
CREATE TABLE YEARCONFIG (
    TAXYEAR       CHAR(4)      NOT NULL,  -- The tax year this configuration applies to
    CITYID        INT          NOT NULL,  -- FK → INSOURCECITY — which city jurisdiction
    DUEDATE       DATETIME,               -- Annual return due date for this year
    ESTIMATEDUE   DATETIME,               -- Estimated payment due date
    INTERESTRATE  NUMERIC(6,4),           -- Annual interest rate for late payments (e.g., 0.07 = 7%)
    PENALTYRATE   NUMERIC(6,4),           -- Annual penalty rate for late filing
    TAXRATE       NUMERIC(6,4),           -- City income tax rate for this year (e.g., 0.025 = 2.5%)
    MINFILING     MONEY,                  -- Minimum gross income requiring a filed return
    MAXPENALTY    NUMERIC(6,4),           -- Maximum penalty as a percentage of tax owed
    YEARSTATUS    CHAR(1)                 -- A=Active (open for filing), C=Closed (no new filings)
);
```

---

### CITYTAXRATES

The detailed rate table by city and effective date, used for computing taxes and credits across all jurisdictions. Covering multiple cities and date ranges, this table supports the full history of rate changes needed to recalculate tax for any prior year.

```sql
CREATE TABLE CITYTAXRATES (
    CITYID     INT          NOT NULL,  -- FK → INSOURCECITY — which city this rate applies to
    STARTDATE  DATETIME     NOT NULL,  -- First date this rate is in effect
    ENDDATE    DATETIME,               -- Last date this rate applies
    TAXRATE    NUMERIC(6,4),           -- The tax rate (e.g., 0.025 = 2.5%)
    CREDITRATE NUMERIC(6,4)            -- The maximum credit rate for taxes paid to this city
);
```

---

### SITECONFIG

The master application configuration table. One row containing 123 columns drives the behavior of the entire application. This covers tax rates and thresholds, interest and penalty calculation rules, electronic filing settings, mailing and printing defaults, integration endpoint URLs, and feature flags. Because it is a single row, changes here affect every user of the system immediately.

---

### TAXCODES

A simple lookup table defining the valid tax type codes used throughout the system.

```sql
CREATE TABLE TAXCODES (
    TAXCODE     CHAR(4),      -- Code identifying the tax type (W=Withholding, I=Individual, B=Business, etc.)
    DESCRIPTION VARCHAR(80)   -- Human-readable description of what this tax type represents
);
```

---

### PAYFREQUENCY

Defines the valid payment frequency codes for employer withholding remittance schedules.

```sql
CREATE TABLE PAYFREQUENCY (
    CODE        CHAR(1),      -- Frequency code: M=Monthly, Q=Quarterly, S=Semi-annual, A=Annual, W=Weekly
    DESCRIPTION VARCHAR(40)   -- Full description of the frequency
);
```

---

### RECSTATU

Status code lookup table used across multiple tables wherever a RECSTATUS column appears. Defines: A=Active, I=Inactive, D=Deleted, and several system-specific status values.

---

### INSOURCECITY

The master city/jurisdiction reference table. Every CITYID foreign key throughout the database points here. It covers all of the Ohio municipalities whose tax data Dublin interacts with — primarily for the purpose of computing and awarding credit for taxes paid to other cities.

```sql
CREATE TABLE INSOURCECITY (
    CODE  INT,           -- Numeric city identifier — the CITYID used throughout the schema
    CITY  VARCHAR(40)    -- Full name of the city or jurisdiction
);
```

---

### INSOURCECODES

Related to INSOURCECITY, this table provides additional code mappings used during data import to translate external city codes (as they appear on W2 tape files from payroll processors) to internal CITYID values.

---

## 16. Users, Roles & Security

The security model in CTTRAIN is a conventional role-based access control system. Every action taken by a user is traceable: login sessions are recorded, screen visits are logged, and the USERID of the person who created or modified a record is captured throughout the schema (in TRANSHST.QUSER, W2ACTIVITY.ACTIVITYUSER, DOCHEADER.USERID, etc.). WORKLIST provides a task queue for outstanding items that require staff attention.

### USERID

The 47 system users represent the full set of staff accounts with access to the tax administration application. Passwords are stored hashed. Each user is assigned a role that controls their access level, and a CITYID that scopes their jurisdiction if the system is deployed across multiple cities.

```sql
CREATE TABLE USERID (
    USERSHORTID  CHAR(10)     NOT NULL,  -- Login ID — the short identifier used throughout the schema
    LNAME        VARCHAR(40),            -- User's last name
    FNAME        VARCHAR(20),            -- User's first name
    PASSWORD     CHAR(60),               -- Hashed password (never stored in plaintext)
    ACTIVE       CHAR(1),                -- Y=Account is active, N=Account is disabled
    ROLE         CHAR(10),               -- FK → ROLES — which role controls this user's permissions
    EMAIL        VARCHAR(80),            -- User's email address
    CREATEDATE   DATETIME,               -- When the account was created
    LASTLOGIN    DATETIME,               -- Timestamp of the most recent login
    CITYID       INT,                    -- FK → INSOURCECITY — city jurisdiction scope for this user
    AUDITORID    INT                     -- FK → AUDITORS — linked auditor record if user is an auditor
);
```

---

### ROLES

Role definitions for the access control system. Each role row defines which screens, functions, and data operations are permitted. The 22-column structure likely maps one column per major system area, with values indicating the permission level (read, write, admin, none) for each area.

---

### AUDITORS

Staff auditors are a distinct entity from general users because they are assigned to taxpayer accounts for review and appear on EMPLOYER and CITMSTR records as the responsible auditor. An auditor may also be a system user (the USERID.AUDITORID foreign key links the two), but the distinction allows auditors to be tracked on case assignments even if they do not have direct system login access.

```sql
CREATE TABLE AUDITORS (
    AUDITORID  INT          NOT NULL,  -- Primary key — unique auditor identifier
    SHORTID    CHAR(10),               -- Three-to-five letter code used on screen displays
    LNAME      VARCHAR(40),            -- Auditor's last name
    FNAME      VARCHAR(20),            -- Auditor's first name
    EMAIL      VARCHAR(80),            -- Auditor's email address
    ACTIVE     CHAR(1),                -- Y=Currently active auditor, N=No longer working audits
    CITYID     INT                     -- FK → INSOURCECITY — city this auditor works for
);
```

---

### SESSIONS / SESSIONSCLOSED / SESSIONEVENT

Session tracking records every login, every screen visited, and every logout. SESSIONS holds active sessions; SESSIONSCLOSED archives completed sessions. SESSIONEVENT logs individual events within a session — which screen a user navigated to and when. This data is used for security audits and for understanding user activity patterns.

---

### WORKLIST

An internal task queue for outstanding items requiring staff action. Items may be auto-generated by the system (e.g., a return has been in error status for more than 30 days) or manually created by supervisors. The low row count (78) suggests most tasks are resolved quickly and the worklist does not persist a long history of completed items.

```sql
CREATE TABLE WORKLIST (
    WORKID    INT          NOT NULL,  -- Primary key — unique task identifier
    TAXID     CHAR(10),               -- FK → TAXPAYER — the account this task relates to
    TASKTYPE  CHAR(6),                -- Code identifying what kind of action is needed
    ASSIGNED  CHAR(10),               -- USERSHORTID of the staff member assigned to this task
    DUEDATE   DATETIME,               -- Deadline for completing this task
    STATUS    CHAR(1),                -- O=Open, C=Closed
    NOTES     VARCHAR(500)            -- Detailed description of the task and any relevant context
);
```

---

## 17. Entity Relationship Diagram

The diagram below shows the primary join relationships between major tables. Foreign keys exist in many additional directions; this focuses on the high-volume joins most relevant to everyday queries.

```
TAXPAYER (288k rows)  ←──────────────────────────────────────────────┐
│  TAXID (PK)                                                         │
│                                                                     │
├──[TAXID]──► ACCOUNTS (86k)                                          │
│               ACCOUNTID (PK)                                        │
│               TAXID → TAXPAYER                                      │
│               CITYID → INSOURCECITY                                 │
│                  ↑                                                  │
│                  └── referenced by EMPLOYER, CITMSTR,               │
│                       RECEIPTS, REFUNDS, TRANSACTIONS               │
│                                                                     │
├──[TAXID]──► EMPLOYER (179k)  [one per employer per year]            │
│               EMPLOYERTAXID (part of PK)                            │
│               TAXYEAR (part of PK)                                  │
│               ACCOUNTID → ACCOUNTS                                  │
│               AUDITORID → AUDITORS                                  │
│               BATCHID → WHBATCH                                     │
│               │                                                     │
│               └──[EMPLOYER]──► CITWAGE (2.8M)                      │
│                                   TAXID → TAXPAYER (employee)      │
│                                   EMPLOYER → TAXPAYER (employer)   │
│                                   │                                 │
│                                   ├──► W2ACTIVITY (2.5M)           │
│                                   └──► W2CITIES (658k)             │
│                                                                     │
├──[TAXID]──► CITMSTR (735k)  [one return per taxpayer per year]      │
│               TAXID → TAXPAYER                                      │
│               ACCOUNTID → ACCOUNTS                                  │
│               AUDITORID → AUDITORS                                  │
│               BATCHID → RETURNBATCH                                 │
│               │                                                     │
│               └──[TAXID+TAXYEAR]──► LINEDET (3.3M)                 │
│                                        FORMID → TAXFORM             │
│                                        LINECODE → LINESCD           │
│                                                                     │
├──[TAXID]──► RECEIPTS (2.3M)  [every payment in]                    │
│               RCTNO (PK)                                            │
│               TAXID → TAXPAYER                                      │
│               ACCOUNTID → ACCOUNTS                                  │
│               BATCHID → PAYBATCH                                    │
│               │                                                     │
│               ├──[RCTNO]──► CITPAY (2.3M)                          │
│               └──[BATCHID]──► PAYBATCH ──[DEPOSITID]──► DEPOSITS   │
│                                                                     │
├──[TAXID]──► REFUNDS (167k)  [every check out]                      │
│               TAXID → TAXPAYER                                      │
│               ACCOUNTID → ACCOUNTS                                  │
│               BATCHID → REFUNDBATCH                                 │
│               REFUNDID → CREDITS                                    │
│                                                                     │
├──[TAXID]──► ASSESSMENTS (646k)                                      │
│               ├──► ADJUSTMENTS (250k)                               │
│               └──── interest accrues via INTEREST rate table        │
│                                                                     │
├──[TAXID]──► TRANSACTIONS (3.5M)  [all financial events]            │
│               ACCOUNTID → ACCOUNTS                                  │
│               USERID → USERID                                       │
│               └──► TRANSHST (4.7M)  [audit trail]                  │
│                                                                     │
├──[TAXID]──► PAYPLANS (107)                                          │
│               └──► PAYPLANAMORT (1.5k)                              │
│               └──► PAYPLANYEARS (159)                               │
│                                                                     │
├──[TAXID]──► DOCHEADER (1.4M)  [document index]                     │
│               └──[DOCID]──► DOCUMENTS (binary — external)          │
│                                                                     │
├──[TAXID]──► LETTERS (136k)                                          │
│               LETTERTYPE → LTRTMPLT                                 │
│               BATCHID → DOCBATCH                                    │
│               AUDITORID → AUDITORS                                  │
│                                                                     │
├──[TAXID]──► ADDRESSES (176k)  ──► ADDRHST (122k)                   │
├──[TAXID]──► CONTACTS (109k)                                         │
└──[TAXID]──► G1099B (56k)                                            │
                                                                      │
REFERENCE / LOOKUP TABLES:                                            │
  INSOURCECITY (197) ←── CITYID used throughout schema ──────────────┘
  YEARCONFIG (39)    ←── TAXYEAR + CITYID
  CITYTAXRATES (1k)  ←── CITYID + date range
  SITECONFIG ←── global application config
  INTEREST (7)       ←── daily rate by date range
  PYMETHCD (12)      ←── payment method codes
  TAXCODES (6)       ←── tax type codes
  ADJUSTTYPES (50)   ←── adjustment type codes
  REFUNDREASON       ←── refund reason codes
  TREINIT            ←── error code definitions
  TAXFORM / LINESCD  ←── form and line structure
  ROLES (22 cols)    ←── permission definitions

USERS / STAFF:
  USERID (47)   ←── USERSHORTID used in audit columns throughout
  AUDITORS (31) ←── AUDITORID used in EMPLOYER and CITMSTR
  WORKLIST (78) ←── open staff tasks
```

---

## 18. Key Queries Reference

The queries below cover the most common lookups needed when working with CTTRAIN data. Each includes comments explaining what it does and why the joins are structured the way they are.

---

### Query 1 — W3 employer withholding record for a specific year

```sql
-- Retrieve the full W3 withholding summary for one employer in one tax year.
-- Joins TAXPAYER to get the employer's name (stored as LNAME for business entities).
-- All financial summary columns (current balance, penalties, payments) come from EMPLOYER.
SELECT
    e.EMPLOYERTAXID,
    t.LNAME                    AS EmployerName,
    e.TAXYEAR,
    e.NUMBEROFW2S,
    e.W3GROSSWAGES,
    e.W3WITHHOLDINGS,
    e.REPORTEDWH               AS DeclaredLiability,
    e.YTDWITHHOLDINGPAYMENTS   AS PaymentsReceived,
    e.CURRENTBALANCE           AS BalanceDue,
    e.PENALTY_CHARGED,
    e.INTEREST_CHARGED,
    e.PAYMENTFREQUENCY,
    e.W3POSTDATE,
    e.RECEIVED                 AS W3Received
FROM EMPLOYER e
JOIN TAXPAYER t ON t.TAXID = e.EMPLOYERTAXID
WHERE e.EMPLOYERTAXID = '263290063W'   -- Replace with the target EIN
  AND e.TAXYEAR       = '2024';        -- Replace with the target year
```

---

### Query 2 — All W2 employee records for an employer in a given year

```sql
-- List every employee's wages and withholdings as reported on W2s for one employer.
-- CITWAGE has one row per employee per employer per year.
-- TAXPAYER is joined on the employee's TAXID to get their name.
-- Results are sorted alphabetically for easy cross-reference with paper W2 submissions.
SELECT
    c.TAXID                AS EmployeeSSN,
    t.LNAME                AS LastName,
    t.FNAME                AS FirstName,
    c.TOTALWAGES,
    c.WITHHOLDINGS         AS CityTaxWithheld,
    c.FEDWAGES,
    c.TRWAGES              AS TaxableResidentWages,
    c.CITYDAYS,
    c.TOTALDAYS,
    c.SOURCE,
    c.WSTATUS
FROM CITWAGE c
JOIN TAXPAYER t ON t.TAXID = c.TAXID
WHERE c.EMPLOYER = '263290063W'        -- Replace with target EIN
  AND c.TAXYEAR  = '2024'             -- Replace with target year
ORDER BY t.LNAME, t.FNAME;
```

---

### Query 3 — Full payment history for a taxpayer

```sql
-- Show every payment received from a taxpayer, with the payment method and batch context.
-- RECEIPTS is the authoritative record of all inbound payments.
-- Filter to active receipts only (RSTATUS = 'A') to exclude voided payments.
-- Add the NSF filter if you want to see bounced checks specifically.
SELECT
    r.RCTNO,
    r.RCTDATE,
    r.TAXYEAR,
    r.TAXPAID,
    r.PENALTYPAID,
    r.INTERESTPAID,
    r.TAXPAID + r.PENALTYPAID + r.INTERESTPAID + r.OTHERPAID  AS TotalPaid,
    p.DESCRIPTION          AS PaymentMethod,
    r.REF                  AS CheckOrReference,
    r.POSTDATE,
    r.NSF                  AS BouncedCheck,
    r.RSTATUS
FROM RECEIPTS r
LEFT JOIN PYMETHCD p ON p.PYMETHOD = r.PYMETHOD
WHERE r.TAXID   = '123456789'          -- Replace with target SSN or FEIN
  AND r.RSTATUS = 'A'                  -- Active receipts only
ORDER BY r.RCTDATE DESC;
```

---

### Query 4 — Refund status lookup for a taxpayer

```sql
-- Show all refund checks issued to a taxpayer, including whether each check has been cashed.
-- DATE_CLEARED and CLEAREDFLAG together show check status.
-- RSTATUS = 'V' rows are voided checks (look for a replacement check in the same results).
SELECT
    r.TRANSACTIONNUMBER,
    r.TAXYEAR,
    r.AMOUNT,
    r.INTERESTPAID,
    r.CHECKNUMBER,
    r.DATEPOSTED,
    r.DATEISSUED,
    r.DATE_CLEARED,
    r.CLEAREDFLAG          AS Cashed,
    r.PAID_TO,
    r.RSTATUS,
    r.REASON,
    r.REFUNDNOTE
FROM REFUNDS r
WHERE r.TAXID = '123456789'            -- Replace with target SSN or FEIN
ORDER BY r.DATEISSUED DESC;
```

---

### Query 5 — Assessment balance and adjustment history for a taxpayer

```sql
-- Show all formal assessments and manual adjustments for a taxpayer,
-- allowing reconstruction of how the current balance was built up.
-- ASSESSMENTS are the original charges; ADJUSTMENTS are subsequent corrections.
-- Combine with a SUM to compute the net liability.

-- Assessments:
SELECT
    'ASSESSMENT'       AS RecordType,
    a.ASSESSDATE       AS EventDate,
    a.TAXYEAR,
    a.AMOUNT           AS TaxAmount,
    a.PENALTY,
    a.INTEREST,
    a.ASSESSTYPE,
    NULL               AS AdjustType,
    NULL               AS Comment
FROM ASSESSMENTS a
WHERE a.TAXID = '123456789'

UNION ALL

-- Adjustments:
SELECT
    'ADJUSTMENT'       AS RecordType,
    adj.ADJUSTDATE     AS EventDate,
    adj.TAXYEAR,
    adj.TAX            AS TaxAmount,
    adj.PENALTY,
    adj.INTEREST,
    NULL               AS AssessType,
    adj.ADJUSTTYPE,
    adj.COMMENT
FROM ADJUSTMENTS adj
WHERE adj.TAXID = '123456789'

ORDER BY EventDate DESC;
```

---

### Query 6 — Complete transaction ledger for a taxpayer account

```sql
-- The TRANSACTIONS table is the unified financial event log.
-- This query shows the running balance across all events for one taxpayer in one year,
-- which is the definitive answer to "what is this account's history?"
SELECT
    tr.TRANSID,
    tr.TRANSDATE,
    tr.TAXYEAR,
    tr.TRANSTYPE,
    tr.AMOUNT,
    tr.PENALTY,
    tr.INTEREST,
    tr.OTHER,
    tr.BALANCE         AS RunningBalance,
    tr.USERID,
    tr.COMMENT
FROM TRANSACTIONS tr
WHERE tr.TAXID   = '123456789'         -- Replace with target SSN or FEIN
  AND tr.TAXYEAR = '2024'             -- Remove this filter for full history across all years
ORDER BY tr.TRANSDATE, tr.TRANSID;
```

---

*Document generated from live schema inspection of CTTRAIN at 10.10.1.133:1433 — May 2026.*
*Last revised: May 2026.*
