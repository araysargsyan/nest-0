declare namespace Express {
  import { ITokenPayload } from '@modules/shared/auth';
  import { FIELD_NAME_FROM_REQ } from '@core/pipes/types';

  interface Request {
    user?: ITokenPayload;
    [FIELD_NAME_FROM_REQ]?: FIELD_NAME_FROM_REQ;
  }

  namespace Multer {
    interface File {
      filesCount: number;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
interface IConstructor<T> extends Function {
  prototype: T;
}

interface IConstructorPrototype<T> {
  constructor: IConstructor<T>;
}
