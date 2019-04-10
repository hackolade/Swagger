const info = {
	required: true,
	hasPatternedObjects: true,
	props: {
		title: {
			required: true
		},
		description: {
			required: false
		},
		termsOfService: {
			required: false
		},
		contact: {
			required: false,
			hasPatternedObjects: true,
			props: {
				name: {
					required: false
				},
				url: {
					required: false
				},
				email: {
					required: false
				},
			}
		},
		license: {
			required: false,
			hasPatternedObjects: true,
			props: {
				name: {
					required: true
				},
				url: {
					required: false
				}
			}
		},
		version: {
			required: true
		}
	}
};

const responses = {
	required: true,
	props: {
		any: {
			required: true,
			props: {
				description: {
					required: true
				}
			}
		}
	}
};

const paths = {
	required: true,
	props: {
		any: {
			required: true,
			props: {
				any: {
					required: true,
					props: {
						responses
					}
				}
			}
		}
	}
};



const securityDefinitions = {
	required: false,
	props: {
		any: {
			required: false,
			props: {
				type: {
					required: true
				},
				name: {
					required: true
				},
				authorizationUrl: {
					required: true
				},
				tokenUrl: {
					required: true
				}
			}
		}
	}
}

const filtrationConfig = {
	swagger: {
		required: true
	},
	info,
	paths,
	securityDefinitions
}

module.exports = filtrationConfig;