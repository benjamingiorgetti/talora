export type CalendarErrorInfo = {
  message: string;
  code: 'auth_invalid' | 'forbidden' | 'not_found' | 'network' | 'unknown';
  recoverable: boolean;
};

export function classifyGoogleError(err: unknown): CalendarErrorInfo {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as any)?.code;

  // Auth errors: unauthorized_client, invalid_grant
  if (message.includes('unauthorized_client') || message.includes('invalid_grant')) {
    return {
      message: 'Las credenciales de Google Calendar no son válidas. Es necesario reconectar el calendario.',
      code: 'auth_invalid',
      recoverable: false,
    };
  }

  // HTTP 403 Forbidden
  if (code === 403) {
    return {
      message: 'No hay permisos para acceder al calendario.',
      code: 'forbidden',
      recoverable: false,
    };
  }

  // HTTP 404 Not Found
  if (code === 404) {
    return {
      message: 'El calendario configurado no existe o fue eliminado.',
      code: 'not_found',
      recoverable: false,
    };
  }

  // Network errors
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
    return {
      message: 'No se pudo conectar con Google Calendar. Intenta de nuevo.',
      code: 'network',
      recoverable: true,
    };
  }

  // Default
  return {
    message: 'Error inesperado al acceder a Google Calendar.',
    code: 'unknown',
    recoverable: true,
  };
}
