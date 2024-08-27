declare namespace Express {
  import { ITokenPayload } from '@modules/shared/auth';

  interface Request {
    user?: ITokenPayload;
  }

  declare module 'express-serve-static-core' {
    interface Request extends Express.Request{}
  }

  namespace Multer {
    interface File {
      ext?: string;
    }
  }
}


// // eslint-disable-next-line @typescript-eslint/ban-types
// interface IConstructor<T> extends Function {
//   prototype: T;
// }
//
// interface IConstructorPrototype<T> {
//   constructor: IConstructor<T>;
// }
//
// type TTypeWithConstructor<T, C> = T & {
//   // eslint-disable-next-line @typescript-eslint/ban-types
//   constructor: Function & C;
// }

type TNonEmptyArray<T> = [T, ...T[]];
interface IEmptyObject {}
type TRecursiveObject<T> = {
  [key in keyof T]?: T[key] & TRecursiveObject<T>;
};
