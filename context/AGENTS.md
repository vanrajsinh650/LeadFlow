# AGENTS.md

## Project
LeadFlow is a sales lead distribution platform designed to automate lead routing, duplicate prevention, SLA enforcement, follow-up tracking, and performance reporting.

## Mandatory Reading Order
Before making any changes:
1. Read [01-product.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/01-product.md)
2. Read [02-business-rules.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/02-business-rules.md)
3. Read [03-architecture.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/03-architecture.md)
4. Read [04-database.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/04-database.md)
5. Read [07-frontend-system.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/07-frontend-system.md) if modifying UI/frontend code
6. Read file(s) related to the task

Never make assumptions without checking the relevant context file.

## Single Source Of Truth
- [01-product.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/01-product.md) → Product truth
- [02-business-rules.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/02-business-rules.md) → Business logic truth
- [03-architecture.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/03-architecture.md) → Architecture truth
- [04-database.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/04-database.md) → Data truth
- [05-api-contracts.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/05-api-contracts.md) → API truth
- [06-workflows.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/06-workflows.md) → Workflow truth
- [07-frontend-system.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/07-frontend-system.md) → Frontend system truth
- [08-engineering-rules.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/08-engineering-rules.md) → Engineering truth
- [09-security-and-operations.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/09-security-and-operations.md) → Security truth
- [10-decisions.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/10-decisions.md) → Architectural decision truth

If implementation conflicts with documentation:
1. **STOP.**
2. Identify which source is outdated.
3. Update documentation before continuing.

## Non-Negotiable Rules
- Never use commit prefixes like `feat:`, `docs:`, `fix:`, `error:`, or `feat..` in commit messages. Write plain, descriptive commit messages explaining what was changed and completed.
- Commit and push changes to GitHub immediately upon completing any small, distinct unit of work, ensuring commits remain small, atomic, and descriptive.
- Never invent APIs.
- Never invent database fields.
- Never invent business rules.
- Never bypass SLA requirements.
- Never bypass duplicate detection.
- Never disable logging.
- Never expose secrets.
- Never commit credentials.
- Never create silent failures.
- Never add dependencies without justification.
- Never modify architecture boundaries without updating [03-architecture.md](file:///c:/Users/Vanrajsinh/Desktop/DevVault/Building-Hub/LeadFlow/context/03-architecture.md).

## Testing Requirements
Every feature requires:
- Unit tests
- Integration tests if APIs change

No code is complete without tests.

## Documentation Requirements
Update context files whenever:
- Architecture changes
- Database changes
- API changes
- Business rules change
- Workflow changes

Code and context must remain synchronized.

## Performance Rules
Avoid:
- N+1 queries
- Unindexed lookups
- Duplicate API calls
- Blocking operations

Prefer:
- Pagination
- Caching
- Batch processing

## Logging Rules
Log:
- Lead creation
- Lead assignment
- Lead reassignment
- Status changes
- SLA violations
- System failures

Never log:
- Passwords
- Secrets
- Tokens

## Error Handling
No silent failures. All failures must:
- Return structured errors
- Be logged
- Be traceable

## Agent Behavior
- Read context first.
- Modify the smallest possible surface area.
- Preserve architecture.
- Preserve existing conventions.
- Ask for clarification when business rules are unclear.
