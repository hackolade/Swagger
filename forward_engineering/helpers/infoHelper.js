const getExtensions = require('./extensionsHelper');

function getInfo(data) {
	const info = {
		description: data.description || "",
		title: data.title || "",
		termsOfService: data.termsOfService || "",
		contact: getContact(data.contact),
		license: getLicense(data.license),
		version: data.modelVersion || ""
	};
	const extensions = getExtensions(data.infoExtensions);
	return Object.assign({}, info, extensions);
}

function getContact(contact) {
	if (!contact) {
		return null;
	}

	return Object.assign({}, {
		name: contact.contactName,
		url: contact.contactURL,
		email: contact.contactemail
	}, getExtensions(contact.contactExtensions));
}

function getLicense(license) {
	if (!license) {
		return null;
	}

	return Object.assign({}, {
		name: license.licenseName,
		url: license.licenseURL
	}, getExtensions(license.contactExtensions));
}

module.exports = getInfo;
