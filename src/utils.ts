type HasOwn = (o: object, v: PropertyKey) => boolean;
export const hasOwn: HasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
