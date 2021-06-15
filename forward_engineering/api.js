const yaml = require('js-yaml');
const validationHelper = require('./helpers/validationHelper');
const getInfo = require('./helpers/infoHelper');
const getPaths = require('./helpers/pathHelper');
const getDefinitions = require('./helpers/definitionsHelper');
const commonHelper = require('./helpers/commonHelper');
const getExtensions = require('./helpers/extensionsHelper');
const convertReferences = require('./helpers/convertReferences');
const utils = require('./utils/utils');
const filtrationConfig = require('./utils/filtrationConfig');
const mapJsonSchema = require('../reverse_engineering/helpers/adaptJsonSchema/mapJsonSchema');
const handleReferencePath = require('./helpers/handleReferencePath');

module.exports = {
	generateModelScript(data, logger, cb) {
		try {
			const {
				dbVersion,
				host,
				basePath,
				schemes,
				consumes: modelConsumes,
				produces: modelProduces,
				externalDocs: modelExternalDocs,
				tags: modelTags,
				security: modelSecurity,
				securityDefinitions: modelSecurityDefinitions
			} = data.modelData[0];

			data = convertReferences(data);
			const info = getInfo(data.modelData[0]);
			const externalDefinitions = JSON.parse(data.externalDefinitions || '{}').properties || {};
			const containers = handleRefInContainers(data.containers, externalDefinitions);
			const paths = getPaths(containers);
			const consumes = commonHelper.mapArrayFieldByName(modelConsumes, 'consumesMimeTypeDef');
			const produces = commonHelper.mapArrayFieldByName(modelProduces, 'producesMimeTypeDef');

			const modelDefinitions = JSON.parse(data.modelDefinitions) || {};
			const definitionsWithHandledReferences = mapJsonSchema(modelDefinitions, handleRef(externalDefinitions));

			const definitions = getDefinitions(definitionsWithHandledReferences, containers);
			const externalDocs = commonHelper.mapExternalDocs(modelExternalDocs);
			const tags = commonHelper.mapTags(modelTags);
			const security = commonHelper.mapSecurity(modelSecurity);
			const securityDefinitions = commonHelper.mapSecurityDefinitions(modelSecurityDefinitions);

			const swaggerSchema = {
				swagger: dbVersion,
				info,
				host,
				basePath,
				schemes,
				consumes,
				produces,
				securityDefinitions,
				security,
				tags,
				externalDocs,
				paths,
				definitions
			};

			const extensions = getExtensions(data.modelData[0].scopesExtensions);
			const filteredSwaggerSchema = utils.removeEmptyObjectFields(Object.assign({}, swaggerSchema, extensions), filtrationConfig);
			
			switch (data.targetScriptOptions.format) {
				case 'yaml': {
					const schema = yaml.safeDump(filteredSwaggerSchema, { skipInvalid: true });
					const schemaWithComments = addCommentsSigns(schema, 'yaml');
					cb(null, schemaWithComments);
					break;
				}
				case 'json':
				default: {
					const schemaString = JSON.stringify(filteredSwaggerSchema, null, 2);
					let schema = addCommentsSigns(schemaString, 'json');
					if (!(data.options && data.options.isCalledFromFETab)) {
						schema = removeCommentLines(schema);
					}
					cb(null, schema);
				}
			}
		} catch (err) {
			const preparedError = {
				message: err.message,
				stack: err.stack,
			}
			logger.log('error', preparedError, 'FE error')
			cb(preparedError);
		}
	},

	validate(data, logger, cb) {
		const { script, targetScriptOptions } = data;

		try {
			const filteredScript = removeCommentLines(script);
			let parsedScript = {};

			switch (targetScriptOptions.format) {
				case 'yaml':
					parsedScript = yaml.safeLoad(filteredScript);
					break;
				case 'json':
				default:
					parsedScript = JSON.parse(filteredScript);
			}

			validationHelper.validate(parsedScript)
				.then((messages) => {
					cb(null, messages);
				})
				.catch(err => {
					cb(err.message);
				});
		} catch (e) {
			logger.log('error', { error: e }, 'Swagger Validation Error');

			cb(e.message);
		}
	}
};

const addCommentsSigns = (string, format) => {
	const commentsStart = /hackoladeCommentStart\d+/i;
	const commentsEnd = /hackoladeCommentEnd\d+/i;
	const innerCommentStart = /hackoladeInnerCommentStart/i;
	const innerCommentEnd = /hackoladeInnerCommentEnd/i;
	const innerCommentStartYamlArrayItem = /- hackoladeInnerCommentStart/i;
	
	const { result } = string.split('\n').reduce(({ isCommented, result }, line, index, array) => {
		if (commentsStart.test(line) || innerCommentStart.test(line)) {
			if (innerCommentStartYamlArrayItem.test(line)) {
				const lineBeginsAt = array[index + 1].search(/\S/);
				array[index + 1] = array[index + 1].slice(0, lineBeginsAt) + '- ' + array[index + 1].slice(lineBeginsAt);
			}
			return { isCommented: true, result: result };
		}
		if (commentsEnd.test(line)) {
			return { isCommented: false, result };
		}
		if (innerCommentEnd.test(line)) {
			if (format === 'json') {
				array[index + 1] = '# ' + array[index + 1];
			}
			return { isCommented: false, result };
		}

		const isNextLineInnerCommentStart = index + 1 < array.length && innerCommentStart.test(array[index + 1]);
		if ((isCommented || isNextLineInnerCommentStart) && !innerCommentStartYamlArrayItem.test(array[index + 1])) {
			result = result + '# ' + line + '\n';
		} else {
			result = result + line + '\n';
		}

		return { isCommented, result };
	}, { isCommented: false, result: '' });

	return result;
}

const removeCommentLines = (scriptString) => {
	const isCommentedLine = /^\s*#\s+/i;

	return scriptString
		.split('\n')
		.filter(line => !isCommentedLine.test(line))
		.join('\n')
		.replace(/(.*?),\s*(\}|])/g, '$1$2');
}

const handleRefInContainers = (containers, externalDefinitions) => {
	return containers.map(container => {
		try {
			const updatedSchemas = Object.keys(container.jsonSchema).reduce((schemas, id) => {
				const json = container.jsonSchema[id];
				try {
					const updatedSchema = mapJsonSchema(JSON.parse(json), handleRef(externalDefinitions));

					return {
						...schemas,
						[id]: JSON.stringify(updatedSchema)
					};
				} catch (err) {
					return { ...schemas, [id]: json }
				}
			}, {});

			return {
				...container,
				jsonSchema: updatedSchemas
			};
		} catch (err) {
			return container;
		}
	});
};


const handleRef = externalDefinitions => field => {
	if (!field.$ref) {
		return field;
	}
	const ref = handleReferencePath(externalDefinitions, field);

	if (!ref.$ref) {
		return ref;
	}

	return { ...field, ...ref }; 
};
