import type { SupabaseClient } from '../../db/supabase.client';

/**
 * Error thrown when user is not authenticated
 */
export class UnauthorizedError extends Error {
  code = 'unauthorized' as const;
  
  constructor(message = 'Invalid or missing authentication token') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error thrown when user is authenticated but lacks required permissions
 */
export class ForbiddenError extends Error {
  code = 'forbidden' as const;
  
  constructor(message = 'Admin privileges required') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Retrieves the current authenticated user ID from Supabase
 * @param supabase - Supabase client instance
 * @returns User ID
 * @throws {UnauthorizedError} When user is not authenticated
 */
export async function getCurrentUserId(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new UnauthorizedError();
  }
  
  return user.id;
}

/**
 * Validates that the current user has admin privileges
 * @param supabase - Supabase client instance
 * @throws {UnauthorizedError} When user is not authenticated
 * @throws {ForbiddenError} When user is not an admin
 */
export async function requireAdmin(
  supabase: SupabaseClient<Database>
): Promise<void> {
  // First, get the current user ID
  const userId = await getCurrentUserId(supabase);
  
  // Query the profiles table to check admin status
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .single();
  
  if (error || !profile) {
    throw new ForbiddenError('Profile not found');
  }
  
  if (!profile.is_admin) {
    throw new ForbiddenError();
  }
}

