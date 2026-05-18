import { createClient } from '@supabase/supabase-js';

// Substitua pelos seus dados reais do projeto no Supabase
const supabaseUrl = 'https://dflwvcdvcpmpytctrqtb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHd2Y2R2Y3BtcHl0Y3RycXRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjI5MDksImV4cCI6MjA5NDA5ODkwOX0.vhP0REI3RSfw1AveX_ZYrC2BcrYWjky0ohueBUQZdUE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);