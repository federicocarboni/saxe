/**
 * [JAXP Processing Limits]:
 * https://docs.oracle.com/javase/tutorial/jaxp/limits/limits.html
 * [libxml2]:
 * https://github.com/GNOME/libxml2
 */

/**
 * Maximum size allowed for a markup identifier.
 * This is not a limitation of the parser but a safety boundary feature.
 */
export const MAX_NAME_LENGTH = 2_000;
/**
 * Maximum size allowed for a parser Map, total number of general and parameter
 * entities and number of attributes per element are affected.
 */
export const MAX_MAP_SIZE = 5_000;
/**
 * Maximum size allowed for a text node.
 */
export const MAX_TEXT_LENGTH = 10_000_000;
export const MAX_ENTITY_LENGTH = 1_000_000;
/**
 * Maximum depth allowed for nested entities.
 */
export const MAX_ENTITY_DEPTH = 40;
