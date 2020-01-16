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
			const paths = getPaths(data.containers);
			const consumes = commonHelper.mapArrayFieldByName(modelConsumes, 'consumesMimeTypeDef');
			const produces = commonHelper.mapArrayFieldByName(modelProduces, 'producesMimeTypeDef');
			const definitions = getDefinitions(data);
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
			cb(err);
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
	
	const { result } = string.split('\n').reduce(({ isCommented, result }, line, index, array) => {
		if (commentsStart.test(line) || innerCommentStart.test(line)) {
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
		if (isCommented || isNextLineInnerCommentStart) {
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
