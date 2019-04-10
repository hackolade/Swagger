'use strict'

const fs = require('fs');
const path = require('path');
const uuid = require('node-uuid');
const yaml = require('js-yaml');

const PARAMETER_TYPES = ['path', 'query', 'header', 'body', 'formData'];
const PARAMETER = 'parameter';
const SUBTYPE_FILE = 'file';
const SUBTYPE_NO_FILE = 'noFile';
const REQUEST = 'request';
const RESPONSE = 'response';
const EXTENSION_SYMBOL = 'x-';

const modelConfig = {
    swagger: 'dbVersion',
    termsOfService: 'termsOfService',
    host: 'host',
    basePath: 'basePath',
    info: 'info',
    security: 'security',
    tags: [{
        name: 'tagName',
        description: 'tagDescription',
        externalDocs: [{
            description: 'tagExternalDocsDescription',
            url: 'tagExternalDocsUrl'
        }]
    }],
    schemes: 'schemes',
    consumes: ['consumesMimeTypeDef'],
    produces: ['producesMimeTypeDef'],
    securityDefinitions: 'securityDefinitions',
    externalDocs: [{
        description: 'externalDocsDescription',
        url: 'externalDocsUrl'
    }],
    scopesExtensions: 'scopesExtensions'
};

const entityConfig = {
    request: {
        tags: ['tag'],
        summary: 'summary',
        description: 'description',
        externalDocs: [{
            description: 'externalDocsDescription',
            url: 'externalDocsUrl'
        }],
        operationId: 'operationId',
        consumes: ['consumesMimeTypeDef'],
        produces: ['producesMimeTypeDef'],
        security: 'security',
        deprecated: 'deprecated'
    },
    response: {
        description: 'description'
    }
};


module.exports = {
	reFromFile(data, logger, callback) {
        getFileData(data.filePath).then(fileData => {
            const extension = getFileExt(data.filePath);
            return getSwaggerSchema(fileData, extension);
        }).then(swaggerSchema => {
            return handleSwaggerData(swaggerSchema);
        }).then(reversedData => {
            return callback(null, reversedData.hackoladeData, reversedData.modelData, [], 'multipleSchema')
        }).
        catch(errorObject => {
            const { error, title } = errorObject;
            const handledError = handleErrorObject(error, title);
            logger.log('error', handledError, title);
            callback(handledError);
        });
	}
};

const getFileExt = (filePath) => {
	return path.extname(filePath);
};

const getFileData = (filePath) => new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf-8', (err, content) => {
        if(err) {
            const errorData = {
                title: 'Error opening file',
                error: err
            };
            reject(errorData);
        } else {
            resolve(content);
        }
    });
});

const convertYamlToJson = (fileData) => {
    return yaml.load(fileData);
};

const getNewId = () => uuid.v1();

const getModelData = (schema) => {
    return handleDataByConfig(schema, modelConfig);
};

const getExtensions = (schema) => {
    const isExtension = (keyword) => keyword.substring(0, 2) === EXTENSION_SYMBOL;
    const getExtension = (keyword, data) => ({
        extensionPattern: keyword,
        extensionValue: data
    });
    
    return Object.keys(schema).reduce((accumulator, key) => {
        if (isExtension(key)) {
            const extension = getExtension(key, schema[key]);
            return [...accumulator, extension];   
        }
        return accumulator;
    }, []);
};

const getExtensionsObject = (data, keyword) => {
    const extensions = getExtensions(data);
    return { [keyword]: extensions };
};

const handleDataByConfig = (data, config) => {
    const getContact = (contact) => ({
        contactName: '',
        contactURL: '',
        contactemail: contact.email,
        contactExtensions: getExtensions(contact)
    });

    const getLicense = (license) => ({
        licenseName: license.name,
        licenseURL: license.url,
        group: {},
        licenseExtensions: getExtensions(license)
    });
    
    const getInfoData = (info) => {
        const contact = info.contact ? [getContact(info.contact)] : [];
        const license = info.license ? [getLicense(info.license)] : [];
        const infoExtensions = getExtensions(info);
        
        return {
            description: info.description,
            modelVersion: info.version,
            title: info.title,
            termsOfService: info.termsOfService,
            contact,
            license,
            infoExtensions,
        };
    };

    const getScopesData = (scopes = {}) => {
        return Object.keys(scopes).reduce((accumulator, key) => {
            const item = {
                securitySchemeScopesName: key,
                securitySchemeScopesDescription: scopes[key]
            };

            return [...accumulator, item]
        }, []);
    };

    const getSecurityDefinitions = (securityDefinitions) => {
        return Object.keys(securityDefinitions).map(item => {
            const itemData = securityDefinitions[item];
            return {
                GUID: getNewId(),
                securitySchemeType: itemData.type,
                securitySchemeIn: itemData.in,
                securitySchemeFlow: itemData.flow,
                securityDefinitionsName: item,
                securitySchemeDescription: itemData.description,
                securitySchemeAuthorizationUrl: itemData.authorizationUrl,
                securitySchemeScopes: getScopesData(itemData.scopes)
            };
        });
    };

    const getSecurityData = (security = []) => {
        return security.reduce((accumulator, item) => {
            const subItems = Object.keys(item).reduce((accum, key) => {
                return [
                    ...accum, 
                    {
                        GUID: getNewId(),
                        securityRequirementName: key,
                        securityRequirementOperation: item[key]
                    }
                ]
            }, []);

            return [...accumulator, ...subItems];
        }, []);
    };

    const handleProperty = (data, config, property) => {
        switch (property) {
            case 'info':
                return getInfoData(data);
            case 'securityDefinitions':
                return { securityDefinitions: getSecurityDefinitions(data) };
            case 'security':
                return { security: getSecurityData(data) };
            default:
                return handleGeneralProperties(data, config[property], property);
        }
    };

    const handleGeneralProperties = (data, config, property) => {
        const configType = Array.isArray(config) ? 'array' : typeof config;

        if (configType === 'array') {
            data = Array.isArray(data) ? data : [data];
            return { [property]: data.map(item => handleDataByConfig(item, config[0])) };
        } else if (configType === 'object') {
            return { [property]: handleDataByConfig(data, config) };
        } else {
            return { [config]: data };
        }
    }

    if (typeof data === 'string') {
        return {
            [config]: data
        };
    }

    const extensionsObject = getExtensionsObject(data, 'extensions');

    return Object.assign(
        extensionsObject,
        Object.keys(config).reduce((accumulator, key) => {
            if (!data[key]) {
                return accumulator;
            }
            return Object.assign({}, accumulator, handleProperty(data[key], config, key))
        }, {})
    );   
};

const getEntityData = (schema, type = REQUEST) => {
    return handleDataByConfig(schema, entityConfig[type]);
};

const getContainers = (pathData) => {
    return Object.keys(pathData).map(key => key);
};

const handleSchemaProps = (schema) => {
    const handleSchemaXml = (data) => ({
        xmlName: data.name,
        xmlNamespace: data.namespace,
        xmlPrefix: data.prefix,
        xmlAttribute: data.attribute,
        xmlWrapped: data.wrapped,
        xmlExtensions: getExtensions(data)
    });

    const handleSchemaProperty = (property, data) => {
        switch(property) {
            case 'xml':
                return [handleSchemaXml(data)];
            default:
                return data;
        }
    };

    return Object.keys(schema).reduce((accumulator, property) => {
        accumulator[property] = (() => {
            if (['properties', 'patternProperties'].includes(property)) {
                return Object.keys(schema[property]).reduce((accum, key) => {
                    accum[key] = handleSchemaProps(schema[property][key]);
                    return accum;
                }, {});
            } else if (property === 'items') {
                return handleSchemaProps(schema[property]);
            } else if (property === 'allOf') {
                return schema.property;
            } else {
                return handleSchemaProperty(property, schema[property]);
            }
        })();
        return accumulator;
    }, {});
};

const getParametersData = (parameters = []) => {
    const reduceParameterSchema = (parameter) => {
        const schema = handleSchemaProps(parameter.schema);
        const newParameter = Object.assign({}, parameter, schema);
        delete newParameter.schema;
        return newParameter;
    };

    const parametersData = parameters.reduce((accumulator, parameter) => {
        const newParameter = parameter.schema ? reduceParameterSchema(parameter) : parameter;
        const inData = accumulator[parameter.in] ? accumulator[parameter.in] : [];
        return Object.assign({}, accumulator, {
            [parameter.in]: [...inData, newParameter]
        });
    }, {});

    const propertiesSchema = PARAMETER_TYPES.reduce((accumulator, paramType) => {
        const properties = (parametersData[paramType] || []).reduce((accumulator, item) => {
            return Object.assign(accumulator, {
                [item.name]: item
            });
        }, {});

        return Object.assign(accumulator, { [paramType]: {
            type: PARAMETER,
            subtype: SUBTYPE_NO_FILE,
            properties
        }});
    }, {});

    return propertiesSchema;
};

const handleRequestData = (requestData, request) => {
    const responses = requestData.responses;
    const entityData = getEntityData(requestData, REQUEST);
    const parametersData = getParametersData(requestData.parameters);
    const jsonSchema = Object.assign({
        type: 'object',
        entityType: REQUEST,
        collectionName: request,
        properties: parametersData
    }, entityData);
    return { jsonSchema, responses };
};

const getResponseData = (responseObj) => {
    const headersData = responseObj.headers || {};
    const schemaData = responseObj.schema ? { schema: handleSchemaProps(responseObj.schema) } : {};
    const propertiesSchema = {
        headers: {
            type: PARAMETER,
            subtype: SUBTYPE_NO_FILE,
            properties: headersData
        },
        body: {
            type: PARAMETER,
            subtype: SUBTYPE_FILE,
            properties: schemaData
        }
    };
    return propertiesSchema;
};

const handleResponseData = (responseObj, response, request, container) => {
    const entityData = getEntityData(responseObj, RESPONSE);
    const responseData = getResponseData(responseObj);
    const jsonSchema = Object.assign({
        type: 'object',
        entityType: RESPONSE,
        collectionName: response,
        parentCollection: request,
        properties: responseData
    }, entityData);
    return jsonSchema;
};

const getEntities = (pathData, containers) => {
    return containers.reduce((accumulator, container) => {
        const containerData = pathData[container];
        const entities = Object.keys(containerData).reduce((accumulator, request) => {
            const requestData = containerData[request];
            const { jsonSchema, responses } = handleRequestData(requestData, request, container);
            const responseSchemas = Object.keys(responses).map(response => {
                return handleResponseData(responses[response], response, request, container)
            });
            return [...accumulator, jsonSchema, ...responseSchemas];
        }, []);
        return Object.assign(accumulator, { [container]: entities });
    }, {});
};


const getModelContent = (pathData) => {
    const containers = getContainers(pathData);
    const entities = getEntities(pathData, containers);
    return { containers, entities };
};

const getDefinitions = (schemaDefinitions) => {
    const definitionsSchema = { properties: schemaDefinitions };
    return handleSchemaProps(definitionsSchema);
};

const convertSwaggerSchemaToHackolade = (swaggerSchema) => {
    const modelData = getModelData(swaggerSchema);
    const definitions = getDefinitions(swaggerSchema.definitions);
    const modelContent = getModelContent(swaggerSchema.paths);
    return { modelData, modelContent, definitions };
};

const getSwaggerSchema = (data, extension) => new Promise((resolve, reject) => {
    try {
        const schema = extension !== '.json' ? convertYamlToJson(data) : data;
        const swaggerSchema = typeof schema === 'string' ? JSON.parse(schema) : schema;
        return resolve(swaggerSchema);
    } catch (error) {
        const errorData = {
            title: 'Error parsing Swagger Schema',
            error
        };
        return reject(errorData);
    }
});

const handleSwaggerData = (swaggerSchema) => new Promise((resolve, reject) => {
    try {
        const convertedData = convertSwaggerSchemaToHackolade(swaggerSchema);
        const { modelData, modelContent, definitions } = convertedData;
        const hackoladeData = modelContent.containers.reduce((accumulator, container) => {
            const currentEntities = modelContent.entities[container];
            return [
                ...accumulator, 
                ...currentEntities.map(entity => {
                    const packageData = {
                        objectNames: {
                            modelName: 'Some name',
                            collectionName: entity.collectionName
                        },
                        doc: {
                            dbName: container,
                            collectionName: entity.collectionName,
                            modelDefinitions: definitions
                        },
                        jsonSchema: entity
                    };
                    return packageData;
                })
            ];
        }, []);
        return resolve({ hackoladeData, modelData });
    } catch (error) {
        const errorData = {
            title: 'Error converting Swagger Schema to Hackolade',
            error
        };
        return reject(errorData);
    }
});

const handleErrorObject = (error, title) => {
    return Object.assign({ title}, Object.getOwnPropertyNames(error).reduce((accumulator, key) => {
        return Object.assign(accumulator, {
            [key]: error[key]
        })
    }, {}));
};