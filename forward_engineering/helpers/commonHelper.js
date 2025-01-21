const getExtensions = require('./extensionsHelper');

function mapExternalDocs(docs) {
	if (docs) {
		return {
			description: docs.externalDocsDescription,
			url: docs.externalDocsUrl,
			...getExtensions(docs.scopesExtensions),
		};
	}
}

function mapExternalTagDocs(docs) {
	if (docs) {
		return {
			description: docs.tagExternalDocsDescription,
			url: docs.tagExternalDocsUrl,
		};
	}
}

function mapTags(tags = []) {
	return tags.map(tag => ({
		name: tag.tagName,
		description: tag.tagDescription,
		externalDocs: mapExternalTagDocs(tag.externalDocs),
	}));
}

function mapSecurity(security = []) {
	return security
		.map(securityRequirement => {
			if (!securityRequirement.securityRequirementName) {
				return null;
			}
			return {
				[securityRequirement.securityRequirementName]: securityRequirement.securityRequirementOperation || [],
			};
		})
		.filter(securityRequirement => securityRequirement);
}

function mapSecurityDefinitions(securityDefinitions = []) {
	const getScopes = (scopes = []) => {
		return scopes.reduce((acc, scope) => {
			acc[scope.securitySchemeScopesName] = scope.securitySchemeScopesDescription;
			return acc;
		}, {});
	};

	const getPropsForType = (type, data) => {
		if (!type || !data) {
			return null;
		}
		switch (type) {
			case 'basic':
				return {
					description: data.securitySchemeDescription,
				};
			case 'apiKey':
				return {
					description: data.securitySchemeDescription,
					name: data.securitySchemeName || '',
					in: data.securitySchemeIn,
				};
			case 'oauth2':
				return {
					description: data.securitySchemeDescription,
					flow: data.securitySchemeFlow,
					scopes: getScopes(data.securitySchemeScopes),
					...getParamsForFlow(data.securitySchemeFlow, data),
				};
			default:
				return null;
		}
	};

	const getParamsForFlow = (flow, data) => {
		const authorizationUrl = data.securitySchemeAuthorizationUrl || '';
		const tokenUrl = data.securitySchemeTokenUrl || '';

		switch (flow) {
			case 'implicit':
				return { authorizationUrl };
			case 'password':
			case 'application':
				return { tokenUrl };
			case 'accessCode':
				return { authorizationUrl, tokenUrl };
			default:
				return null;
		}
	};

	return securityDefinitions.reduce((acc, secDef) => {
		acc[secDef.securityDefinitionsName] = {
			type: secDef.securitySchemeType,
			...getPropsForType(secDef.securitySchemeType, secDef),
			...getExtensions(secDef.scopesExtensions),
		};
		return acc;
	}, {});
}

function mapArrayFieldByName(dataArray, fieldName) {
	return dataArray?.map(dataItem => dataItem[fieldName]);
}

function activateItem(item) {
	if (!item || typeof item !== 'object') {
		return item;
	}
	return {
		...item,
		isActivated: true,
	};
}

module.exports = {
	mapExternalDocs,
	mapTags,
	mapSecurity,
	mapSecurityDefinitions,
	mapArrayFieldByName,
	activateItem,
};
