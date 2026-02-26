import { DatabaseSchema } from './interfaces/schema.interface';
import { TRIPS_SCHEMA } from '../trips/entities/trip.schema';
import { BOOKINGS_SCHEMA } from '../bookings/entities/booking.schema';

const ALL_SCHEMAS: DatabaseSchema[] = [
  BOOKINGS_SCHEMA,
  TRIPS_SCHEMA,
];

function sortSchemas(schemas: DatabaseSchema[]): DatabaseSchema[] {
  const seen = new Set<string>();
  const result: DatabaseSchema[] = [];

  const visit = (schema: DatabaseSchema) => {
    if (seen.has(schema.name)) return;
    schema.dependsOn.forEach((depName) => {
      const dep = schemas.find((s) => s.name === depName);
      if (dep) visit(dep);
    });
    seen.add(schema.name);
    result.push(schema);
  };

  schemas.forEach((s) => visit(s));
  return result;
}

export const SORTED_SCHEMAS = sortSchemas(ALL_SCHEMAS);