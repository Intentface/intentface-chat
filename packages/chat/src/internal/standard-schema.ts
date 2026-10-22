// The parts of the Standard Schema and Standard JSON Schema specs this package
// reads (https://standardschema.dev), restated as structural types so any
// compliant validator fits without a dependency. MIT, Standard Schema authors.

/** One problem found by a validator. */
export type StandardIssue = {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
};

type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardIssue> };

/** A schema that validates: zod, Valibot, ArkType and others implement it. */
export type StandardSchema<Input = unknown, Output = Input> = {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
};

/** A schema that can describe itself as JSON Schema (zod 4.2+, ArkType 2.1.28+, Valibot 1.2+). */
export type StandardJSONSchema = {
  readonly "~standard": {
    readonly jsonSchema: {
      readonly input: (options: { readonly target: string }) => Record<string, unknown>;
    };
  };
};

export type InferOutput<Schema extends StandardSchema> = NonNullable<
  Schema["~standard"]["types"]
>["output"];
