declare namespace Express {
  import { ITokenPayload } from '@modules/shared/auth';

  interface Request {
    user?: ITokenPayload;
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
interface IConstructor<T> extends Function {
  prototype: T;
}

interface IConstructorPrototype<T> {
  constructor: IConstructor<T>;
}
