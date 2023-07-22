// Add in your email and key for the EPC API - removed in order not to expose keys
const email = "XXX";
const apiKey = "XXX";

// Global variables
let currentPage = 1;
let selectedPropertyData = null;

// API request
function makeRequestToEPCAPI(endpoint, params, callback) {
  const apiBaseUrl = 'https://epc.opendatacommunities.org/api/v1/domestic';
  const authToken = btoa(`${email}:${apiKey}`);
  const url = `${apiBaseUrl}/${endpoint}?${params}`;

  fetch(url, {
    headers: {
      'Authorization': `Basic ${authToken}`,
      'Accept': 'application/json',
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('API request failed');
      }
      return response.text();
    })
    .then(data => {
      try {
        const jsonData = data ? JSON.parse(data) : null;
        callback(jsonData);
      } catch (error) {
        console.error('Error parsing JSON data:', error);
        console.log('Response data:', data);
      }
    })
    .catch(error => console.error('API request failed:', error));
}

// Display matching results
function displayResults(response) {
  const container = document.getElementById("resultsContainer");
  container.innerHTML = "";

  // Check if the response data is empty or not
  if (!response || !response.rows || response.rows.length === 0) {
    const searchTerm = document.getElementById("addressInput").value;
    container.innerHTML = `No results for '${searchTerm}'`;
    return;
  }

  const div = document.createElement("div");

  response.rows.forEach(function (result) {
    const button = document.createElement("button");
    button.textContent = result.address;
    button.addEventListener("click", function () {
      // Remove the selected class from all buttons
      const allButtons = document.querySelectorAll("#resultsContainer button");
      allButtons.forEach(function (btn) {
        btn.classList.remove("selected");
      });

      // Add the selected class to the clicked button
      button.classList.add("selected");

      // Call the displayDetails function on the selected property
      displayDetails(result.uprn);
    });
    div.appendChild(button);
  });

  container.appendChild(div);

  // Enable or disable pagination buttons based on the number of results and the current page
  const prevPageButton = document.getElementById("prevPageButton");
  const nextPageButton = document.getElementById("nextPageButton");
  prevPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = response.rows.length < 10;
}

// Perform basic analysis of data of selected property
function performAnalysis(response) {
  const analysisContainer = document.getElementById("analysisContainer");
  analysisContainer.innerHTML = "";

  if (!response || !response.rows || response.rows.length === 0) {
    analysisContainer.innerHTML = "No data for analysis.";
    return;
  }

  const analysisResults = document.createElement("div");

  // Compare energy performance with other properties with the same postcode
  const postcode = response.rows[0]['postcode'];
  if (postcode) {
    const params = `postcode=${encodeURIComponent(postcode)}&size=100`;
    makeRequestToEPCAPI('search', params, function (response) {
      if (!response || !response.rows || response.rows.length === 0) {
        analysisContainer.appendChild(document.createElement("hr"));
        analysisContainer.innerHTML += "No data available for properties with the same postcode.";
        return;
      }

      // Calculate the average energy efficiency score of properties with same postcode
      let totalEnergyEfficiency = 0;
      for (let i = 0; i < response.rows.length; i++) {
        let currentEfficiency = response.rows[i]['current-energy-efficiency'];
        totalEnergyEfficiency += Number(currentEfficiency);
      }
      const averageEnergyEfficiency = totalEnergyEfficiency / response.rows.length;
      const averageLetterBand = getLetterBandForNumericValue(averageEnergyEfficiency);
      // Round the average efficiency value to the nearest whole number
      const roundedAverageEfficiency = Math.round(averageEnergyEfficiency);
      // Access the current-energy-efficiency value from the selected property data
      const currentEnergyEfficiency = selectedPropertyData.rows[0]['current-energy-efficiency'];
      const currentLetterBand = selectedPropertyData.rows[0]['current-energy-rating'];

      // Display the current property's energy efficiency rating and the average efficiency for the postcode
      const comparisonWithSimilarProperties = document.createElement("p");
      comparisonWithSimilarProperties.textContent =
        "Comparison with properties with the same postcode: Current property efficiency - " +
        currentLetterBand + " (" + currentEnergyEfficiency + ")" +
        ", Average efficiency of similar properties - " +
        averageLetterBand + " (" + roundedAverageEfficiency + ")";
      analysisResults.appendChild(comparisonWithSimilarProperties);
      analysisContainer.appendChild(document.createElement("hr"));
      analysisContainer.appendChild(analysisResults);
    });
  } else {
    // If the property doesn't have postcode, display a message
    analysisContainer.innerHTML += "No address available for the current property.";
  }
}

// Retrieve letter band for a given numeric value
function getLetterBandForNumericValue(value) {
  if (value >= 92) return 'A';
  else if (value >= 81) return 'B';
  else if (value >= 69) return 'C';
  else if (value >= 55) return 'D';
  else if (value >= 39) return 'E';
  else if (value >= 21) return 'F';
  else return 'G';
}

// Display property details and perform analysis
function displayDetails(uprn) {
  const params = "size=1&uprn=" + uprn;
  makeRequestToEPCAPI("search", params, function (response) {
    // Store the response data for the selected property in the global variable
    selectedPropertyData = response;

    const container = document.getElementById("detailsContainer");
    container.innerHTML = "";

    const details = response.rows[0];

    const table = document.createElement("table");
    for (let key in details) {
      const row = document.createElement("tr");

      const th = document.createElement("th");
      th.textContent = key;
      row.appendChild(th);

      const td = document.createElement("td");
      td.textContent = details[key];
      row.appendChild(td);

      table.appendChild(row);
    }

    container.appendChild(table);
    container.style.display = "block";

    // Perform analysis and display results
    performAnalysis(response);

    // Scroll to the analysis section automatically
    const analysisSection = document.getElementById("analysisContainer");
    analysisSection.scrollIntoView({ behavior: "smooth" });
  });
}

// Handle form submission
function handleFormSubmit(event) {
  event.preventDefault();
  const searchTerm = document.getElementById("addressInput").value;
  const pageSize = 10;

  // Check if the user input is a postcode or an address
  let isPostcode = false;
  if (searchTerm.match(/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/)) {
    // If the input matches a postcode pattern, set isPostcode to true
    isPostcode = true;
  }

  // Calculate the pagination offset (from) based on the current page and page size
  const offset = (currentPage - 1) * pageSize;

  // Construct the API request parameters based on whether it's a postcode or address search
  const params = isPostcode
    ? `postcode=${encodeURIComponent(searchTerm)}&from=${offset}&size=${pageSize}`
    : `address=${encodeURIComponent(searchTerm)}&from=${offset}&size=${pageSize}`;

  makeRequestToEPCAPI('search', params, displayResults);
}

// Navigate pages
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    handleFormSubmit(new Event('submit'));
  }
}

function nextPage() {
  currentPage++;
  handleFormSubmit(new Event('submit'));
}

// Event listeners
const form = document.getElementById("addressForm");
form.addEventListener("submit", handleFormSubmit);

const prevPageButton = document.getElementById("prevPageButton");
prevPageButton.addEventListener("click", prevPage);

const nextPageButton = document.getElementById("nextPageButton");
nextPageButton.addEventListener("click", nextPage);

// Function to scroll to the top of the page
function scrollToTop() {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome etc.
}