# Nest-0 Backend Application

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

A progressive backend interface powered by the **NestJS** (v10) framework, utilizing **Prisma ORM**, an advanced JWT authentication workflow with token rotation, and custom event-driven nested files and stream processing.

## 🚀 Architectural Design & Core Patterns

The project follows the modular design principles of NestJS, enforcing a strict separation of concerns (SoC).

### 🛠 Key Architectural Features:
1. **Advanced File Processing (`Nested & Enhanced File Processors`):**
   * **`NestedFilesInterceptor`**: A custom interceptor engineered to parse and validate complex, deeply nested Multipart/Form-data requests (handling tree-like structures of fields and files). It dynamically maps fields (`fieldsMap`) via regular expressions while maintaining strict upload limits.
   * **`EnhanceFileInterceptor`**: A high-level architectural abstraction built on top of native NestJS interceptors. It centralizes Multer exception handling, provides dynamic MIME-type filtering, and automates safe, collision-free UUID file renaming.
2. **Security & Session Control (JWT Rotation via HTTP-Only Cookies):**
   * Employs dual authentication strategies: `AccessStrategy` (extracting Bearer Tokens from headers) and `RefreshStrategy` (extracting Refresh Tokens seamlessly from Secure Cookies).
   * Features a smart `JwtAccessAuthGuard` designed to intercept logouts safely. If an access token expires while a user requests a logout, the guard evaluates the validity of the refresh token from cookies, preventing stale client-side sessions.
3. **Database-Driven Asynchronous Validation:**
   * Built on top of `class-validator`, the custom `@IsUnique()` decorator relies on `reflect-metadata` and Dependency Injection (DI) to asynchronously query database services for records checking (e.g., verifying email or username availability) before the payload hits the controller layer.
4. **Unified Exception & SPA Filtering Layer:**
   * The global `HttpExceptionFilter` intercepts all application-level anomalies, formats them into standard RFC-compliant JSON responses with timestamps and paths, and uses a `chalk`-powered logger. It is tailored to handle `404 Not Found` conflicts smoothly by falling back to static single-page application (SPA) files.

---

## 🏗 Tech Stack

* **Framework:** NestJS v10 (Core, Common, Passport, JWT)
* **ORM:** Prisma Client v5.18
* **Database:** PostgreSQL / MySQL (configurable via DATABASE_URL)
* **Authentication:** Passport.js (JWT Access / Refresh token rotation)
* **Validation & Transformation:** Class-Validator, Class-Transformer
* **Utilities:** UUID, Bcrypt, Cookie-Parser, Chalk, RxJS

---

## 📂 Project Structure (src)

```text
src/
├── common/                  # Global utilities, constants, and helpers
│   ├── constants/           # Metadata keys, environment settings, JWT configs
│   ├── constraints/         # Custom validation rules (e.g., UniqueConstraint)
│   ├── decorators/          # Custom decorators (@Public, @User, @IsUnique, @ValidatorOptions)
│   ├── helpers/             # Field mapping layout generators for nested forms
│   └── logger/              # Custom logger wrapper with Chalk integration
├── core/                    # System core components
│   ├── exceptions/          # Global anomaly filters (HttpExceptionFilter)
│   ├── guards/              # Route guards and Passport policies (Access/Refresh)
│   └── interceptors/        # Structural interceptors (EnhanceFile, NestedFiles)
├── modules/                 # Isolated application business logic
│   └── shared/              # Shared platform utilities (AuthModule, PrismaModule)
├── main.ts                  # Application bootstrap entrypoint
└── app.module.ts            # Root module declaration
