# Static Code Intelligence Features

This document provides in-depth explanations of the static intelligence engines built into `@vortiqlabs/codebase-indexer`.

---

## 1. Impact Analysis (`ImpactAnalyzer`)

Static impact analysis determines the ripple effect of changing a symbol or file.

### How It Works
1. Identifies target symbols and target file paths.
2. Traverses incoming relations (`calls`, `imports`, `extends`, `implements`, `references`).
3. Distinguishes confidence levels:
   - **`DIRECT`**: Immediate caller or importer (depth = 1).
   - **`TRANSITIVE`**: Multi-hop dependent (depth > 1) with high confidence.
   - **`POSSIBLE`**: Inferred or lower-confidence relation.
4. Cross-references affected files with HTTP API endpoints and test suites.

### Output Example
```json
{
  "target": "UserService",
  "directDependents": [
    { "name": "startApp", "filePath": "src/app.ts", "kind": "calls", "confidence": "DIRECT", "depth": 1 }
  ],
  "transitiveDependents": [],
  "affectedFiles": ["src/user.ts", "src/app.ts", "tests/user.test.ts"],
  "affectedSymbols": ["UserService", "startApp"],
  "affectedApis": ["GET /users"],
  "affectedTests": ["tests/user.test.ts"]
}
```

---

## 2. Test Intelligence (`TestAnalyzer`)

Maps production code to test files and determines which tests to run when source files change.

### Capabilities
- **Direct Relations**: Identifies test files importing or calling production symbols.
- **Naming Conventions**: Matches `auth.ts` -> `auth.test.ts`, `auth.spec.ts`, `__tests__/auth.test.ts`.
- **Affected Tests Discovery**: Given a list of changed files, returns only affected test suites.

---

## 3. Database Intelligence (`DatabaseAnalyzer`)

Detects database schemas and ORM entities without database connections or network calls.

### Frameworks Supported
- **Prisma**: Parses `schema.prisma` files for models, fields, types, `@id`, and optionality.
- **SQL DDL**: Parses `CREATE TABLE` DDL statements in `.sql` migration files.
- **ORM Entities**: Detects model/entity classes across TypeORM, Sequelize, Mongoose, Drizzle, and Django.

---

## 4. Git & Change Intelligence (`GitHistory` & `ChangeAnalyzer`)

Extracts version control insights directly from local `.git` repositories.

### Capabilities
- **Commit History & Uncommitted Status**: Safely retrieves log history and modified files.
- **Co-Change Coupling**: Calculates historical co-change percentages (e.g., `A.ts` and `B.ts` changed together in 90% of multi-file commits).
- **Hotspot Detection**: Identifies high-risk files based on commit frequency and complexity.

---

## 5. Code Quality & Complexity (`ComplexityAnalyzer`)

Computes deterministic code metrics per file and symbol.

### Metrics Computed
- **Lines of Code (LOC)**: Total lines per file and symbol range.
- **Cyclomatic Complexity**: Heuristic calculation based on control flow decision branches (`if`, `else`, `for`, `while`, `catch`, `case`, `&&`, `||`, `?`).
- **Nesting & Symbol Sizes**: Function, class, and module size diagnostics.

---

## 6. Symbol Explanations (`ExplainSymbol`)

Gathers deterministic structural evidence for a symbol without an LLM.

### Aggregated Information
- **Definition Location**: File path, start/end lines.
- **Inbound & Outbound Calls**: Callers and callees.
- **Type Hierarchy**: `extends` and `implements` relations.
- **Coverage**: Associated test files.
- **API & Database Linkage**: Endpoints and schema models related to the symbol.
