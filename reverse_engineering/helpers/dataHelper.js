
const commonHelper = require('./commonHelper');
const propertiesConfig = require('../propertiesConfig');
const jsonComment = require('comment-json');

const PARAMETER_TYPES = ['path', 'query', 'header', 'body', 'formData'];
const PARAMETER = 'parameter';
const SUBTYPE_FILE = 'file';
const SUBTYPE_NO_FILE = 'noFile';
const REQUEST = 'request';
const RESPONSE = 'response';
const EXTENSION_SYMBOL = 'x-';
const REQUEST_TYPE = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', '$ref'];

const getExtensions = (schema) => {
    const isExtension = (keyword) => keyword.substring(0, 2) === EXTENSION_SYMBOL;
    const getExtension = (keyword, data) => ({
        extensionPattern: keyword,
        extensionValue: typeof data === 'object' ? JSON.stringify(data) : data
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
        contactName: contact.name,
        contactURL: contact.url,
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
        const contact = info.contact ? getContact(info.contact) : {};
        const license = info.license ? getLicense(info.license) : {};
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
                GUID: commonHelper.getNewId(),
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
                        GUID: commonHelper.getNewId(),
                        securityRequirementName: key,
                        securityRequirementOperation: item[key]
                    }
                ]
            }, []);

            return [...accumulator, ...subItems];
        }, []);
    };

    const getExamplesData = (examples = {}) => {
        return Object.keys(examples).reduce((accumulator, key) => {
             return [
                 ...accumulator, 
                 {
                     examplesMimeType: key,
                     examplesValue: commonHelper.stringify(examples[key])
                 }
             ]
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
            case 'examples':
                return { examples: getExamplesData(data) };
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
    return handleDataByConfig(schema, propertiesConfig.entityConfig[type]);
};

const getContainers = (pathData) => {
    return Object.keys(pathData).map(key => {
        const extensionsObject = getExtensionsObject(pathData[key], 'extensions');
        return Object.assign({ name: key }, extensionsObject);
    });
};

const handleSchemaProps = (schema, fieldOrder) => {
    const extensionKeyByType = type => type === 'string' ? 'xmlExtensions' : 'scopesExtensions';
    const handleSchemaXml = (data, type) => ({
        xmlName: data.name,
        xmlNamespace: data.namespace,
        xmlPrefix: data.prefix,
        xmlAttribute: data.attribute,
        xmlWrapped: data.wrapped,
        [extensionKeyByType(type)]: getExtensions(data)
    });

    const handleSchemaProperty = (property, data, type) => {
        switch(property) {
            case 'xml':
                return handleSchemaXml(data, type);
            case 'additionalProperties':
                return Boolean(data);
            default:
                return data;
        }
    };

    const setMissedType = (schema) => {
        if ((schema.properties || schema.patternProperties) && !schema.type) {
            schema.type = 'object';
        } else if (schema.items && !schema.type) {
            schema.type = 'array';
        }
        return schema;
    }

    const getPropName = (property) => {
        return property === 'example' ? 'sample' : property;
    } 

    const fixedSchema = setMissedType(schema);
    const reorderedSchema = commonHelper.reorderFields(fixedSchema, fieldOrder);

    return Object.keys(reorderedSchema).reduce((accumulator, property) => {
        const propName = getPropName(property);
        accumulator[propName] = (() => {
            if (['properties', 'patternProperties'].includes(property)) {
                return Object.keys(reorderedSchema[property]).reduce((accum, key) => {
                    accum[key] = handleSchemaProps(reorderedSchema[property][key], fieldOrder);
                    return accum;
                }, {});
            } else if (property === 'items') {
                return handleSchemaProps(reorderedSchema[property], fieldOrder);
            } else if (property === 'allOf') {
                return schema.property;
            } else {
                return handleSchemaProperty(property, reorderedSchema[property], reorderedSchema.type);
            }
        })();
        return accumulator;
    }, {});
};

const getParametersData = (parameters = [], fieldOrder) => {
    const reduceParameterSchema = (parameter) => {
        const schema = handleSchemaProps(parameter.schema, fieldOrder);
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

const handleRequestData = (requestData, request, fieldOrder) => {
    const responses = requestData.responses;
    const entityData = getEntityData(requestData, REQUEST);
    const parametersData = getParametersData(requestData.parameters, fieldOrder);
    const jsonSchema = Object.assign({
        type: 'object',
        entityType: REQUEST,
        collectionName: request,
        properties: parametersData,
        isActivated: true
    }, entityData);
    return { jsonSchema, responses };
};

const getResponseData = (responseObj, fieldOrder) => {
    const headersData = responseObj.headers || {};
    const schemaData = responseObj.schema ? { schema: handleSchemaProps(responseObj.schema, fieldOrder) } : {};
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

const handleResponseData = (responseObj, response, request, fieldOrder) => {
    const entityData = getEntityData(responseObj, RESPONSE);
    const responseData = getResponseData(responseObj, fieldOrder);
    const jsonSchema = Object.assign({
        type: 'object',
        entityType: RESPONSE,
        collectionName: response,
        parentCollection: request,
        properties: responseData,
        isActivated: true
    }, entityData);
    return jsonSchema;
};

const getEntities = (pathData, containers, fieldOrder) => {
    return containers.reduce((accumulator, container) => {
        const containerData = pathData[container.name];
        const entitiesNames = Object.keys(containerData).filter(item => REQUEST_TYPE.includes(item));
        const entities = entitiesNames.reduce((accumulator, request) => {
            const requestData = containerData[request];
            const { jsonSchema, responses } = handleRequestData(requestData, request, container.name, fieldOrder);
            const responseSchemas = Object.keys(responses).map(response => {
                return handleResponseData(responses[response], response, request, fieldOrder)
            });
            return [...accumulator, jsonSchema, ...responseSchemas];
        }, []);
        return Object.assign(accumulator, { [container.name]: entities });
    }, {});
};


const getModelData = (schema) => {
    return handleDataByConfig(schema, propertiesConfig.modelConfig);
};

const getDefinitions = (schemaDefinitions = {}, fieldOrder) => {
    const definitionsSchema = { properties: schemaDefinitions };
    const handledDefinitions = handleSchemaProps(definitionsSchema, fieldOrder);
    return JSON.stringify({
        definitions: handledDefinitions.properties
    });
};

const getModelContent = (pathData, fieldOrder) => {
    const containers = getContainers(pathData);
    const entities = getEntities(pathData, containers, fieldOrder);
    return { containers, entities };
};

const getSwaggerJsonSchema = (data, fileName, extension) => {
    const schema = extension !== '.json' ? commonHelper.convertYamlToJson(data) : data;
    const swaggerSchema = typeof schema === 'string' ? jsonComment.parse(schema.replace(/^\s*#.+$/mg, '')) : schema;
    const swaggerSchemaWithModelName = Object.assign({}, swaggerSchema, {
        modelName: fileName
    });
    return swaggerSchemaWithModelName;
};


const validateSwaggerSchema = (schema) => {
    const isCorrectVersion = schema.swagger === '2.0';
    return isCorrectVersion;
};

module.exports = {
	getModelData,
	getDefinitions,
    getModelContent,
    getSwaggerJsonSchema,
    validateSwaggerSchema
};
