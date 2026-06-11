# Nest-0: The Ultimate Architectural Reference Manual

This repository serves as an exhaustive reference implementation for complex NestJS patterns, focusing on **Atomic Request Processing**, **Advanced File Handling**, and **Integrated Security & Validation Logic**.

---

## 1. Development & Setup

1. **Install**: `npm install`
2. **Environment**: Create `.env` with `DB_URL="postgresql://user:pass@localhost:5432/nest-0"`.
3. **Database**: `npx prisma db push` to synchronize the schema.
4. **Run**: `npm run start:dev` for development mode with watch.

---

## 2. Project Overview & Philosophy

Nest-0 is built on the "Atomic" request principle (**All-or-Nothing**). In a modern web application, a single request often involves multiple side effects: uploading files to disk, checking database uniqueness, and validating complex DTOs. 

In many systems, if DTO validation fails *after* a file has been uploaded, that file remains on the server as "garbage." Nest-0 solves this by synchronizing the lifecycle of Interceptors, Guards, and Pipes. If any part of the validation chain fails, the system automatically rolls back side effects (e.g., deleting temporary files) before the request ever reaches the controller.

---

## 3. Global Infrastructure & Bootstrapping (`src/main.ts`)

The entry point of the application sets up a robust foundation:
- **DI-Powered Validation**: `useContainer(app.select(AppModule))` connects NestJS's Dependency Injection with the `class-validator` library. This is what allows our `UniqueConstraint` to inject the `PrismaService` or `UserService`.
- **Global Sanitization**: `ResponseInterceptor` is applied globally to ensure every outgoing response is processed through our serialization layer.
- **Middleware Integration**: 
    - `cookie-parser`: Essential for reading `refreshToken` from secure, HttpOnly cookies.
    - `LoggerMiddleware`: Automatically logs the method and URL for every incoming request.
- **Dynamic Prefixing**: Uses `ConfigService` to set a global API prefix (e.g., `/api`) dynamically from environment variables.

---

## 4. Modular Architecture (The Backbone)

The application is organized into highly decoupled modules, coordinated by a central infrastructure hub.

### 4.1 `SharedModule` (Global Infrastructure Hub)
`SharedModule` is the foundation of the app. It centralizes all cross-cutting concerns:
- **`ConfigModule`**: Loaded with `.env` support and variable expansion. Available globally.
- **`ServeStaticModule`**: Asynchronously configured to serve files from the `public` directory.
- **`PrismaModule`**: Provides a singleton `PrismaService` for database operations.
- **`AuthModule`**: (Located in `shared/auth`) Handles JWT strategies, token generation, and security logic.
- **`UploadModule`**: Centralizes Multer configurations used by various interceptors.

### 4.2 `AppModule`
The root node that imports `SharedModule`, `UserModule`, and `ProductModule`. 
- **Global Providers**: It registers `HttpExceptionFilter` (as `APP_FILTER`) and `GlobalValidationPipe` (as `APP_PIPE`). This allows these components to use Dependency Injection while remaining global.
- **Middleware Application**: Implements `NestModule` to apply `LoggerMiddleware` to all routes.

---

## 5. Common Layer: Utilities, Constants & Custom Features (`src/common/`)

Shared logic, definitions, and custom decorators used across all modules.

### 5.1 Custom Decorators Deep-Dive
- **`@IsUnique(serviceMethod)`**: The core of our async validation. It marks a field for a database check.
  ```typescript
  export class SignUpDto {
    @IsUnique('isEmailUnique') // Calls UserService.isEmailUnique
    email: string;
  }
  ```
- **`@Public()`**: A metadata decorator that tells guards to skip authentication for a specific route.
  ```typescript
  @Public()
  @Get('check-status')
  async checkStatus() {
    return { status: 'OK' };
  }
  ```
- **`@User(key?)`**: Type-safe extraction of the user payload from the request.
  ```typescript
  @Get('me')
  @UseGuards(JwtAccessAuthGuard)
  async me(@User('id') userId: number) { 
    return userId; 
  }
  ```
- **`@ValidatorOptions(options)`**: Per-DTO customization for `class-validator`.
    - **Skip Validation**: If you pass `null` (e.g., `@ValidatorOptions(null)`), validation for that DTO will be skipped entirely.
    ```typescript
    @ValidatorOptions({ 
      whitelist: true, 
      forbidNonWhitelisted: true,
      stopAtFirstError: true 
    })
    export class CreateProductDto { ... }
    ```

### 5.2 Constants (`src/common/constants/`)
Centralized definitions to ensure type safety and consistency:
- **`auth.const.ts`**: Defines token keys (`accessToken`, `refreshToken`) and strategy names (`JwtAccess`, `JwtRefresh`).
- **`core.const.ts`**: Contains critical **Metadata Keys** used by the engine, such as `BODY_ERRORED`, `FILE_METADATA`, `HAS_UNIQUE`, and `VALIDATOR_OPTIONS`.
- **`global.const.ts`**: Maps environment variable keys (e.g., `APP_PORT`, `DB_URL`, `JWT_SECRET`) to constant identifiers.

### 5.3 Constraints (`src/common/constraints/`)
- **`UniqueConstraint`**: The implementation of the `@IsUnique` logic. It uses `Reflect.metadata` to identify "pending" validation states and dynamically invokes the specified service method to verify data against the database.
- **Provider Registration**: To enable Dependency Injection (DI) within the constraint, it must be provided in the module:
  ```typescript
  @Module({
    providers: [
      UserService,
      createUniqueConstraintProvider(UserService),
    ],
  })
  export class UserModule {}
  ```

### 5.4 Custom Logger
Enhanced `Logger` class using `chalk` for colorized console output.
- **Styling**: Features bright yellow context and blue-bright labels.
- **Methods**: Includes `info(message, context?)` and `infoMessage(message)` for high-signal debugging.

### 5.5 Helpers
- **`GenerateMultiFields`**: Automates Multer field array generation for flat and nested structures.
- **`wait(ms)`**: Standard async delay utility.

---

## 6. Core Layer: The System Engine (`src/core/`)

The architectural heart of Nest-0, implementing security, complex parsing, and the atomic validation chain.

### 6.1 Security & Authentication
Nest-0 implements a secure, session-based JWT authentication system with **hashed Refresh Tokens** and **HttpOnly Cookies**.
- **`JwtAccessAuthGuard`**: 
    - Protects routes using the `AccessStrategy` (Bearer Token).
    - **Usage Example**:
      ```typescript
      @Get('profile')
      @UseGuards(JwtAccessAuthGuard)
      async getProfile(@User() user: ITokenPayload) {
        return user;
      }
      ```
    - **Specialized Logout Logic**: If the Access Token is expired, the guard specifically checks the `refreshToken` cookie for the `logout` endpoint. If valid, it allows the user to proceed so they can be signed out from the database.
- **`JwtRefreshAuthGuard`**: Uses the `RefreshStrategy` to extract tokens exclusively from secure cookies.
    - **Usage Example**: Typically used only for the token rotation endpoint.
      ```typescript
      @Get('refresh')
      @UseGuards(JwtRefreshAuthGuard)
      async refresh(@Req() { user, res }: Request) {
        // Logic to generate new ITokens
      }
      ```
- **`AuthService` Lifecycle**:
    1. **Hashing**: Password and Refresh tokens are hashed via `bcrypt` before DB storage (`hashedRt`).
    2. **Verification**: `verifyToken` performs a cross-check between the incoming cookie and the stored hash.
    3. **Rotation**: Every `refresh` call rotates the token pair and updates the DB hash.

### 6.2 Interceptors (The Parsers)
- **`ResponseInterceptor`**: Automates data sanitization. It uses `class-transformer` to convert instances to plain objects, stripping fields marked with `@Exclude()` (like `hash`).
- **`EnhanceFileInterceptor`**: A high-order wrapper providing UUID filenames and mapping Multer errors to field-level response errors.
- **`NestedFilesInterceptor`**: A recursive parser supporting deep multipart fields like `images[0][files]` using regex mapping.

### 6.3 The Triple-Pipe Validation System
Request validation and file handling are processed in three coordinated stages:
1. **`GlobalValidationPipe`**: Executes `@IsUnique` checks and standard DTO rules. Tags the request with `BODY_ERRORED` metadata on failure.
2. **`FileValidationPipe`**: Uses `UploadFileTypeValidator` to verify **Magic Numbers** (actual bytes). If `BODY_ERRORED` is detected, it deletes all temporary files immediately.
3. **`MargeFilesToBodyPipe`**: Merges separate `request.files` back into the `request.body`, allowing for filtered reconstruction.

### 6.4 Exception Filtering & SPA Fallback
**`HttpExceptionFilter`** standardizes all errors and handles routing:
- **Consistency**: Returns errors in a fixed JSON format (timestamp, status, path, message, errors).
- **SPA Fallback**: Catching a `404` error serves `public/index.html`, enabling client-side routing (React/Vue/etc.) without extra server configuration.

---

## 7. Product Module: The Upload Showcase

The **`ProductController`** (`src/modules/product/product.controller.ts`) serves as the primary reference implementation for file handling in Nest-0. It contains **5 real-world usage scenarios** demonstrating the integration of all technologies described above:

1.  **Multiple File Gallery**: Classic multiple file upload with path merging.
2.  **Single Documentation**: Handling single file updates.
3.  **Multiple Named Fields**: Using `FileFieldsInterceptor` for categorized uploads.
4.  **Recursive Nested Structures**: Deep-level file mapping (e.g., `images[0][files]`).
5.  **Dynamic Nested Generation**: Automated configuration using the `GenerateMultiFields` helper.

This controller is the best place to see how **EnhanceFileInterceptor**, **NestedFilesInterceptor**, and the **Triple-Pipe system** work together in practice.

---
*Nest-0: Building resilient, atomic, and type-safe Node.js applications.*
