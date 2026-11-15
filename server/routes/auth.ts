import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { User, type UserRole } from '../models.ts';
import { recordAuditLog, requireAuth, signToken, type AuthedRequest } from '../middleware/auth.ts';
import { validateEmail, validatePassword, validatePhone } from '../utils/validation.ts';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body || {};

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    }
    if (!email || !validateEmail(String(email))) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!phone || !validatePhone(String(phone))) {
      return res.status(400).json({ error: 'Please provide a valid 10 to 15 digit phone number.' });
    }
    const pwCheck = validatePassword(String(password || ''));
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.message });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Public registration allows customer, store_owner, or delivery_partner; qa_admin requires existing QA or explicit choice in academic mode
    const allowedSelfRoles: UserRole[] = ['customer', 'store_owner', 'delivery_partner'];
    const assignedRole: UserRole = allowedSelfRoles.includes(role) ? role : 'customer';

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      passwordHash,
      role: assignedRole,
      isSeeded: false,
    });

    const token = signToken({
      userId: String(user._id),
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    });

    await recordAuditLog({
      actorId: String(user._id),
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      module: 'Authentication',
      entityType: 'User',
      entityId: String(user._id),
      details: `Registered new ${user.role} account (${user.email})`,
    });

    return res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isSeeded: user.isSeeded,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(String(password), user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken({
      userId: String(user._id),
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    });

    await recordAuditLog({
      actorId: String(user._id),
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      module: 'Authentication',
      entityType: 'User',
      entityId: String(user._id),
      details: `Signed in as ${user.role}`,
    });

    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isSeeded: user.isSeeded,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.user!.userId).select('-passwordHash -resetToken -resetTokenExpiry').lean();
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ user });
});

router.patch('/profile', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { name, phone } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }
    if (!phone || !validatePhone(String(phone))) {
      return res.status(400).json({ error: 'Please provide a valid 10 to 15 digit phone number.' });
    }
    const updated = await User.findByIdAndUpdate(
      req.user!.userId,
      { $set: { name: String(name).trim(), phone: String(phone).trim() } },
      { new: true }
    ).select('-passwordHash -resetToken -resetTokenExpiry');

    return res.json({ user: updated });
  } catch {
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !validateEmail(String(email))) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    const resetToken = crypto.randomBytes(4).toString('hex').toUpperCase();
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await recordAuditLog({
      actorId: String(user._id),
      actorName: user.name,
      actorRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      module: 'Authentication',
      entityType: 'User',
      entityId: String(user._id),
      details: 'Generated academic simulated password reset code.',
    });

    return res.json({
      message: 'Academic Test Mode: Reset code generated and stored in MongoDB (valid 15 minutes).',
      simulatedResetCode: resetToken,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword } = req.body || {};
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ error: 'Email, reset code, and new password are required.' });
    }
    const pwCheck = validatePassword(String(newPassword));
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.message });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (
      !user ||
      !user.resetToken ||
      user.resetToken !== String(resetCode).trim().toUpperCase() ||
      !user.resetTokenExpiry ||
      user.resetTokenExpiry.getTime() < Date.now()
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    await recordAuditLog({
      actorId: String(user._id),
      actorName: user.name,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      module: 'Authentication',
      entityType: 'User',
      entityId: String(user._id),
      details: 'Password updated via reset flow.',
    });

    return res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch {
    return res.status(500).json({ error: 'Password reset failed.' });
  }
});

router.post('/logout', requireAuth, async (req: AuthedRequest, res) => {
  await recordAuditLog({
    actorId: req.user!.userId,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'USER_LOGOUT',
    module: 'Authentication',
    entityType: 'User',
    entityId: req.user!.userId,
    details: 'User logged out and cleared client session.',
  });
  return res.json({ message: 'Logged out successfully.' });
});

export default router;
