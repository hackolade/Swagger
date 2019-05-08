const modelConfig = {
    modelName: 'modelName',
    swagger: 'dbVersion',
    termsOfService: 'termsOfService',
    host: 'host',
    basePath: 'basePath',
    info: 'info',
    security: 'security',
    tags: [{
        name: 'tagName',
        description: 'tagDescription',
        externalDocs: {
            description: 'tagExternalDocsDescription',
            url: 'tagExternalDocsUrl'
        }
    }],
    schemes: 'schemes',
    consumes: ['consumesMimeTypeDef'],
    produces: ['producesMimeTypeDef'],
    securityDefinitions: 'securityDefinitions',
    externalDocs: {
        description: 'externalDocsDescription',
        url: 'externalDocsUrl'
    },
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
        description: 'description',
        examples: 'examples'
    }
};

module.exports = {
    modelConfig,
    entityConfig
};