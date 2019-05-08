'use strict'

const commonHelper = require('./helpers/commonHelper');
const dataHelper = require('./helpers/dataHelper');
const errorHelper = require('./helpers/errorHelper');

module.exports = {
	reFromFile(data, logger, callback) {
        commonHelper.getFileData(data.filePath).then(fileData => {
            return getSwaggerSchema(fileData, data.filePath);
        }).then(swaggerSchema => {
            const fieldOrder = data.fieldInference.active;
            return handleSwaggerData(swaggerSchema, fieldOrder);
        }).then(reversedData => {
            return callback(null, reversedData.hackoladeData, reversedData.modelData, [], 'multipleSchema')
        }).
        catch(errorObject => {
            const { error, title } = errorObject;
            const handledError =  commonHelper.handleErrorObject(error, title);
            logger.log('error', handledError, title);
            callback(handledError);
        });
	}
};

const convertSwaggerSchemaToHackolade = (swaggerSchema, fieldOrder) => {
    const modelData = dataHelper.getModelData(swaggerSchema);
    const definitions = dataHelper.getDefinitions(swaggerSchema.definitions, fieldOrder);
    const modelContent = dataHelper.getModelContent(swaggerSchema.paths, fieldOrder);
    return { modelData, modelContent, definitions };
};

const getSwaggerSchema = (data, filePath) => new Promise((resolve, reject) => {
    const { extension, fileName } = commonHelper.getPathData(filePath);

    try {
        const swaggerSchemaWithModelName = dataHelper.getSwaggerJsonSchema(data, fileName, extension);
        const isValidSwaggerSchema = dataHelper.validateSwaggerSchema(swaggerSchemaWithModelName);

        if (isValidSwaggerSchema) {
            return resolve(swaggerSchemaWithModelName);
        } else {
            return reject(errorHelper.getValidationError(new Error('Selected file is not a valid Swagger 2.0 schema')));
        }
    } catch (error) {
        return reject(errorHelper.getParseError(error));
    }
});

const handleSwaggerData = (swaggerSchema, fieldOrder) => new Promise((resolve, reject) => {
    try {
        const convertedData = convertSwaggerSchemaToHackolade(swaggerSchema, fieldOrder);
        const { modelData, modelContent, definitions } = convertedData;
        const hackoladeData = modelContent.containers.reduce((accumulator, container) => {
            const currentEntities = modelContent.entities[container.name];
            return [
                ...accumulator, 
                ...currentEntities.map(entity => {
                    const packageData = {
                        objectNames: {
                            collectionName: entity.collectionName
                        },
                        doc: {
                            dbName: container.name,
                            collectionName: entity.collectionName,
                            modelDefinitions: definitions,
                            bucketInfo: container
                        },
                        jsonSchema: entity
                    };
                    return packageData;
                })
            ];
        }, []);
        return resolve({ hackoladeData, modelData });
    } catch (error) {
        return reject(errorHelper.getConvertError(error));
    }
});