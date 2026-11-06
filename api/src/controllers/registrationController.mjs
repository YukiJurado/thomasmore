import * as registrations from '../services/registrationService.mjs';

export async function getRegistrations(req, res) {
  res.json(await registrations.listRegistrations(req.validated.params.id));
}

export async function register(req, res) {
  const registration = await registrations.register(req.validated.params.id, req.validated.body);
  res.status(201).json(registration);
}
