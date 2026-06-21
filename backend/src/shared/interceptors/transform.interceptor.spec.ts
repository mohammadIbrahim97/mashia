import { ExecutionContext, CallHandler } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { of, lastValueFrom } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform response to include statusCode and data payload', async () => {
    // Arrange
    const mockData = { id: 1, name: 'Test Object' };

    // Create a mock ExecutionContext
    const mockExecutionContext = {
      switchToHttp: () => ({
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;

    // Create a mock CallHandler that returns an observable with our mock data
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };

    // Act
    const resultObservable = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await lastValueFrom(resultObservable);

    // Assert
    expect(result).toEqual({
      statusCode: 200,
      data: mockData,
    });
  });

  it('should transform undefined or null response correctly', async () => {
    // Arrange
    const mockExecutionContext = {
      switchToHttp: () => ({
        getResponse: () => ({
          statusCode: 204,
        }),
      }),
    } as unknown as ExecutionContext;
    const mockCallHandler: CallHandler = {
      handle: () => of(undefined),
    };

    // Act
    const resultObservable = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await lastValueFrom(resultObservable);

    // Assert
    expect(result).toEqual({
      statusCode: 204,
      data: undefined,
    });
  });

  it('should transform array response correctly', async () => {
    // Arrange
    const mockData = [{ id: 1 }, { id: 2 }];
    const mockExecutionContext = {
      switchToHttp: () => ({
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };

    // Act
    const resultObservable = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await lastValueFrom(resultObservable);

    // Assert
    expect(result).toEqual({
      statusCode: 200,
      data: mockData,
    });
  });
});
