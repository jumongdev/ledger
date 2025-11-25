import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hwcypjgvdadseyancznj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3Y3lwamd2ZGFkc2V5YW5jem5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNDQwNDQsImV4cCI6MjA3OTYyMDA0NH0.9u7oQ7CbtBCP8XEmvNFYFQa1NVGfrUjeJKqNw_k8MDE';

export const supabase = createClient(supabaseUrl, supabaseKey);
