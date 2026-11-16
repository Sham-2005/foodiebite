// ─────────────────────────────────────────────────────────────
//  frontend/src/services/demoFoodService.js
//  FoodieBite Supabase Isolated Experiment Service
//  Fetches sample food records from 'foodiebite_demo'.
//  Note: Safe read-only SELECT operation. No auth or write permissions required.
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabaseClient.js';

/**
 * Retrieves food records from the experimental 'foodiebite_demo' table.
 * 
 * @returns {Promise<{
 *   success: boolean,
 *   data: Array<{
 *     id: number | string,
 *     food_name: string,
 *     category: string,
 *     created_at: string
 *   }>,
 *   error: string | null
 * }>}
 */
export async function fetchDemoFoods() {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      data: [],
      error: 'Supabase credentials are not configured in environment variables.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      data: [],
      error: 'Supabase client instance is unavailable.',
    };
  }

  try {
    const { data, error } = await client
      .from('foodiebite_demo')
      .select('id, food_name, category, created_at')
      .order('id', { ascending: true });

    if (error) {
      return {
        success: false,
        data: [],
        error: error.message || 'Error executing SELECT on foodiebite_demo.',
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err.message || 'Network exception while fetching demo foods.',
    };
  }
}

export default {
  fetchDemoFoods,
};

