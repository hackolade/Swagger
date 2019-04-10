const validationHelper = require('./helpers/validationHelper');
const getInfo = require('./helpers/infoHelper');
const getPaths = require('./helpers/pathHelper');
const getDefinitions = require('./helpers/definitionsHelper');
const commonHelper = require('./helpers/commonHelper');
const getExtensions = require('./helpers/extensionsHelper');
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

			cb(null, JSON.stringify(filteredSwaggerSchema, null, 4));
		} catch (err) {
			cb(err);
		}
	},

	validate(data, logger, cb) {
		const { script } = data;

		try {
			const parsedScript = JSON.parse(script);

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
