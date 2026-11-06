import { z } from 'zod';

const idSchema = z.object({
  id: z.coerce.number().int().positive()
});

export function validateEventId(req, res, next) {
  const result = idSchema.safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'params',
          message: issue.message
        }))
      }
    });
  }

  req.validatedParams = result.data;
  next();
}
