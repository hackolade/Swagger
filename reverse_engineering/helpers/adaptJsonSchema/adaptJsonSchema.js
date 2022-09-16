const mapJsonSchema = require('./mapJsonSchema');

const convertToString = (jsonSchema) => {
	return Object.assign({}, jsonSchema, {
		type: 'string',
	});
};

const handleNumericType = (jsonSchema) => {
	if (jsonSchema.mode === 'int') {
		return {
			...jsonSchema,
			type: 'integer'
		}
	}
	if (jsonSchema.mode === 'decimal') {
		return {
			...jsonSchema,
			type: 'number',
			mode: 'double'
		}
	}

	return jsonSchema;
};

const adaptJsonSchema = (jsonSchema) => {
	return mapJsonSchema(jsonSchema, (jsonSchemaItem) => {
		if (jsonSchemaItem.type === 'number') {
			return handleNumericType(jsonSchemaItem);
		} else if (jsonSchemaItem.type !== 'null') {
			return jsonSchemaItem;
		}

		return convertToString(jsonSchemaItem);
	});
};

module.exports = adaptJsonSchema;
