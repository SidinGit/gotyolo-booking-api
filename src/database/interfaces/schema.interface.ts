export interface DatabaseSchema {
  name: string;      // Table name
  dependsOn: string[]; // Dependencies (e.g., ['trips'])
  setup?: string;    // Domain-specific setup (Enums, Extensions, Types)
  table: string;     // The actual CREATE TABLE SQL
}