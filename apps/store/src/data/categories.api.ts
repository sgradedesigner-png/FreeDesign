// src/data/categories.api.ts
import { supabase } from "../lib/supabase";

export type Category = {
  id: string;
  name: string;
  slug: string;
};

// Fetch all categories from database
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
