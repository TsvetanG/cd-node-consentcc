/*
Copyright Chaindigit.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
// DO NOT USE IN PRODUCTION

const shim = require('fabric-shim');
const ClientIdentity = require('fabric-shim').ClientIdentity;

// Used to log
var logger = shim.newLogger('consentcc');
// The log level can be set by 'CORE_CHAINCODE_LOGGING_SHIM' to CRITICAL, ERROR,
// WARNING, DEBUG
logger.level = 'debug';

var Chaincode = class {
	async Init(stub) {
	  logger.info('ChainCode Initialize');

      return shim.success();
	}

	async Invoke(stub) {
		logger.info('ChainCode Invoke');
		let fap = stub.getFunctionAndParameters();
		let func = fap.fcn;
		let args = fap.params;

		logger.info('Invoke function' + func);

		if (func === 'query') {
			return await this.query(stub, args);
		}

		if (func === 'consent') {
			return await this.consent(stub, args);
		}
		
		if (func === 'removeConsent') {
			return await this.removeConsent(stub, args);
		}

		logger.Errorf(`Unknown action: ${func}`);
		return shim.error(`Unknown action: ${func}`);
	}
	
	async removeConsent(stub, args) {
		logger.info("Removes consent");
		logger.info("Number of parameters: " + args.length);

		if (args.length != 1) {
			return shim.error('Expecting client ID as input');
		}
		
		let clientID = args[0];

		logger.info(`Client ID = ${clientID}`);
		
		//The user performing transaction will be taken as the one removed from the consent
		let callerIdentity = new ClientIdentity(stub);
		
		logger.info(`Caller MSP ID = ${callerIdentity.getMSPID()}`);

		logger.info(`Caller ID = ${callerIdentity.getID()}`); 
	 	
		let iterator = await stub.getStateByPartialCompositeKey("clid~mspid", [ clientID , callerIdentity.getMSPID() ] );
		
		while (true) {
			let res = await iterator.next();
			//let theVal = stub.splitCompositeKey(res.value.key);
			logger.info('deleteing state ' + res.value.key);
			await stub.deleteState(res.value.key);
			logger.info('deleteing state');
			if (res.done) {
				logger.info('end of data');
				await iterator.close(); 
			}
	    }
		
		logger.info("Consent removed!");
		return shim.success(Buffer.from('Consent remove succeed'));
	}

	async consent(stub, args) {
		logger.info("Provide consent for a given client id");
		logger.info("Number of parameters: " + args.length);

		if (args.length != 1) {
			return shim.error('Expecting client ID as input');
		}
		
		let clientID = args[0];
		logger.info(`Client ID = ${clientID}`);
		
		//The user performing transaction will be recorded as consent holder

		let callerIdentity = new ClientIdentity(stub); 
		
		logger.info(`Caller MSP ID = ${callerIdentity.getMSPID()}`);
		
		logger.info(`Caller ID = ${callerIdentity.getID()}`);

		//specific Access Control logic can be coded based on the attributes owned by the caller
		//To use this feature the user should have proper certificate
		let canRecordConsent = callerIdentity.assertAttributeValue("Consent", "true");
		
		logger.info( `Caller can record consent = ${canRecordConsent}`  );
		let value = [ clientID, callerIdentity.getMSPID() ];
		let compKey = stub.createCompositeKey("clid~mspid", value );
		
				
		await stub.putState(compKey, Buffer.from("X"));//Just record the consent
		
		logger.info("Consent recorded!");
		return shim.success(Buffer.from('move succeed'));
	}

	async query(stub, args) {
		logger.info("Query Number of parameters: " + args.length);
		if (args.length != 1) {
			return shim.error('Expecting client ID as input');
		}
		let clientID = args[0];
		
		logger.info("Query consent for client: " + clientID);
	 	
		let iterator = await stub.getStateByPartialCompositeKey("clid~mspid", [ clientID ] );
		
		let allResults = [];
		
		while (true) {
			let res = await iterator.next();
			logger.info('Iterator result: ' + res);
			let theVal = stub.splitCompositeKey(res.value.key);
			let mspId = theVal.attributes[1];
			let consent = res.value.value.toString('utf8');
			theVal = mspId + ":" + consent;
			logger.info('Consent pair ' + theVal);
			allResults.push(theVal);
			console.log(theVal);
			
			if (res.done) {
				logger.info('End of data set');
				await iterator.close(); 
				logger.info('Iterator closed');
				break;
			}
			
	    }
		
		let jsonResp = {
			ClientID: clientID,
			Consents: allResults
		};
		

		logger.info('Response to query:%s\n', JSON.stringify(jsonResp));

		return shim.success(Buffer.from(JSON.stringify(jsonResp)));
	}

};

// start the chaincode process
shim.start(new Chaincode());