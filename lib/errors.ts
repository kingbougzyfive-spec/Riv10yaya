/** An error that carries an HTTP status and a message that is safe to show the person. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
