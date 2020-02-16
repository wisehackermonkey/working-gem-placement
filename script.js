const SETUP_URL = 'http://www.hiddengems.app/race/register/';
const UPDATE_URL = 'http://www.hiddengems.app/race/update/';
const GEM_COLLECTION_DISTANCE = 0.00002865;						// In degrees, where this is roughly 6.378m
const GEM_POINT_VALUE = 10;

function setupActor(actorID, linePoints, gemLocations, duration, refreshInterval, moveCB, removeGemCB) {
	const variability = 0.1;						// Number 0 and 1 for variation above or below average step
	const numSteps = duration / refreshInterval;
	const averageStep = 1 / numSteps;
	let position = 0;
	let coordinates = 0;
	let actorPoints = 0;

	let currentStep = 0;
	waitForStart(actorID, (err, data) => {
		if (err != null) {
			console.error("Wait for start error");
			return;
		}

		const interval = setInterval(function() {
			// Stop interval after race
			currentStep ++;
			if (currentStep > numSteps) {
				clearInterval(interval);
				return;
			}

			// Advance actor
			position += averageStep * (1 + (Math.random() - 0.5) * 2 * variability);
			coordinates = getPosOnPath(position, linePoints);

			// Check for intersection with gem
			for (let i = 0; i < gemLocations.length; i++) {
				// Return whether Euclidean distance is less than some threshold
				if (Math.sqrt(
					Math.pow((gemLocations[i].lat - coordinates.lat), 2)
					+ Math.pow((gemLocations[i].lng - coordinates.lng), 2))
					< GEM_COLLECTION_DISTANCE) {
					removeGemCB(i);
					actorPoints += GEM_POINT_VALUE;
				}
			}

			// updateServer(actorID, position, actorPoints, actors => {
			//
			// });

			// Pass new player coordinates out to callback
			moveCB({
				coordinates: coordinates,
				relativePlace: position
			});
		}, refreshInterval);
	});
}

function waitForStart(actorID, cb) {
	$.ajax(SETUP_URL + actorID, {
		type: 'POST',  // http method
		data: {},  // data to submit
		success: function (data, status, xhr) {
			cb(null, data.data);
		},
		error: function (jqXhr, textStatus, errorMessage) {
			cb(errorMessage, null);
		}
	});
}

function updateServer(actorID, pos, actorPoints, cb) {
	$.ajax(UPDATE_URL + actorID, {
		type: 'POST',  // http method
		data: {
			data: {
				points: actorPoints,
				position: pos
			}
		},  // data to submit
		success: function (data, status, xhr) {
			cb(null, data.data);
		},
		error: function (jqXhr, textStatus, errorMessage) {
			cb(errorMessage, null);
		}
	});
}

function getPosOnPath(pos, linePoints) {
	// Figure out the total length of the path
	let pathLength = 0;
	for (let i = 0; i < linePoints.length-1; i++) {
		let nextPoint = linePoints[i+1];
		let thisPoint = linePoints[i];
		// Euclidean distance between this point and the next
		pathLength += Math.sqrt(
			Math.pow((nextPoint.lat - thisPoint.lat), 2)
			+ Math.pow((nextPoint.lng - thisPoint.lng), 2)
		);
	}

	// Figure out what segment (between two linePoints) the current position is in, and then where in that segment
	let distanceTraveled = pos * pathLength;
	for (let i = 0; i < linePoints.length-1; i++) {
		// Figure out length of this segment
		let nextPoint = linePoints[i+1];
		let thisPoint = linePoints[i];
		// Euclidean distance between this point and the next
		let segmentContribution = Math.sqrt(
			Math.pow((nextPoint.lat - thisPoint.lat), 2)
			+ Math.pow((nextPoint.lng - thisPoint.lng), 2)
		);

		// If this segment is less than the amount of travel remaining, subtract it off and move onto the next
		if (segmentContribution <= distanceTraveled) {
			distanceTraveled -= segmentContribution;
		// Otherwise, find the desired position within this segment and return it
		} else {
			let segmentPortion = distanceTraveled / segmentContribution;	// Progress on segment 0-1 as start to end
			let latDif = nextPoint.lat - thisPoint.lat;
			let lngDif = nextPoint.lng - thisPoint.lng;

			return {
				lat: thisPoint.lat + segmentPortion * latDif,
				lng: thisPoint.lng + segmentPortion * lngDif
			}
		}
	}
}