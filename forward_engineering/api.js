const helper = require('../helper/helper.js');
const schemaHelper = require('../helper/schemaHelper.js');

module.exports = {
	generateScript(data, logger, cb) {
		const { jsonSchema, modelData, containerData, entityData, isUpdateScript } = data;
		let result = "";
		let fieldsSchema = this.getFieldsSchema({
			jsonSchema: JSON.parse(jsonSchema),
			internalDefinitions: JSON.parse(data.internalDefinitions),
			modelDefinitions: JSON.parse(data.modelDefinitions),
			externalDefinitions: JSON.parse(data.externalDefinitions)
		});
		let typeSchema = this.getTypeSchema(entityData, fieldsSchema);
		let mappingScript = this.getMappingScript(containerData, typeSchema);

		if (isUpdateScript) {
			result = this.getCurlScript(mappingScript, modelData, containerData);
		} else {
			result += this.getKibanaScript(mappingScript, containerData);
		}

		cb(null, result);
	},

	getCurlScript(mapping, modelData, indexData) {
		const host = modelData.host || 'localhost';
		const port = modelData.port || 9200;
		const indexName = indexData.name || "";

		return `curl -XPUT '${host}:${port}/${indexName.toLowerCase()}?pretty' -H 'Content-Type: application/json' -d '\n${JSON.stringify(mapping, null, 4)}\n'`;
	},

	getKibanaScript(mapping, indexData) {
		const indexName = indexData.name || "";

		return `PUT /${indexName.toLowerCase()}\n${JSON.stringify(mapping, null, 4)}`;
	},

	getFieldsSchema(data) {
		const {
			jsonSchema
		} = data;
		let schema = {};

		if (!(jsonSchema.properties && jsonSchema.properties._source && jsonSchema.properties._source.properties)) {
			return schema;
		}

		schema = this.getSchemaByItem(jsonSchema.properties._source.properties, data)

		return schema;
	},

	getSchemaByItem(properties, data) {
		let schema = {};

		for (let fieldName in properties) {
			let field = properties[fieldName];

			schema[fieldName] = this.getField(field, data);
		}

		return schema;
	},

	getField(field, data) {
		let schema = {};
		const fieldProperties = helper.getFieldProperties(field.type, field, {});
		let type = this.getFieldType(field);

		if (type !== 'object' && type !== 'array') {
			schema.type = type;
		}

		if (type === 'object') {
			schema.properties = {};
		}

		this.setProperties(schema, fieldProperties, data);

		if (type === 'geo_shape' || type === 'geo_point') {
			return schema;
		} else if (field.properties) {
			schema.properties = this.getSchemaByItem(field.properties, data);
		} else if (field.items) {
			let arrData = field.items;

			if (Array.isArray(field.items)) {
				arrData = field.items[0];
			}

			schema = Object.assign(schema, this.getField(arrData, data));
		}

		return schema;
	},

	getFieldType(field) {
		switch(field.type) {
			case 'geo-shape':
				return 'geo_shape';
			case 'geo-point':
				return 'geo_point';
			case 'number':
				return field.mode || 'long';
			case 'string':
				return field.mode || 'text';
			case 'range':
				return field.mode || 'integer_range';
			case 'null':
				return 'long';
			default:
				return field.type;
		}
	},

	setProperties(schema, properties, data) {
		for (let propName in properties) {
			if (propName === 'stringfields') {
				try {
					schema['fields'] = JSON.parse(properties[propName]);
				} catch (e) {
				}
			} else if (this.isFieldList(properties[propName])) {
				const names = schemaHelper.getNamesByIds(
					properties[propName].map(item => item.keyId),
					[
						data.jsonSchema,
						data.internalDefinitions,
						data.modelDefinitions,
						data.externalDefinitions
					]
				);
				if (names.length) {
					schema[propName] = names.length === 1 ? names[0] : names;
				}
			} else {
				schema[propName] = properties[propName];
			}
		}

		return schema;
	},

	getTypeSchema(typeData, fieldsSchema) {
		let script = {};

		if (typeData.dynamic) {
			script.dynamic = typeData.dynamic;
		}

		script.properties = fieldsSchema;

		return {
			[(typeData.collectionName || "").toLowerCase()]: script
		};
	},

	getMappingScript(indexData, typeSchema) {
		let mappingScript = {};
		let settings = this.getSettings(indexData);
		let aliases = this.getAliases(indexData);

		if (settings) {
			mappingScript.settings = settings;
		}

		if (aliases) {
			mappingScript.aliases = aliases;
		}

		mappingScript.mappings = typeSchema;

		return mappingScript;
	},

	getSettings(indexData) {
		let settings;
		let properties = helper.getContainerLevelProperties();
		
		properties.forEach(propertyName => {
			if (indexData[propertyName]) {
				if (!settings) {
					settings = {};
				}

				settings[propertyName] = indexData[propertyName];
			}
		});

		return settings;
	},

	getAliases(indexData) {
		let aliases;

		if (!indexData.aliases) {
			return aliases;
		}

		indexData.aliases.forEach((alias) => {
			if (alias.name) {
				if (!aliases) {
					aliases = {};
				}

				aliases[alias.name] = {};

				if (alias.filter) {
					let filterData = "";
					try {
						filterData = JSON.parse(alias.filter);
					} catch (e) {}

					aliases[alias.name].filter = {
						term: filterData
					};
				}

				if (alias.routing) {
					aliases[alias.name].routing = alias.routing;
				}
			}
		});

		return aliases;
	},

	isFieldList(property) {
		if (!Array.isArray(property)) {
			return false;
		}

		if (!property[0]) {
			return false;
		}

		if (property[0].keyId) {
			return true;
		}

		return false;
	}
};