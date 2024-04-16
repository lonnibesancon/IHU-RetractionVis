// Google Spreadsheet URL
const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSZMRkkQWNEz6zzcOaI3PwJohV6rqS6cYl5rTJm0LrQb9hthouOMdf4YfuDXr2bDgny9F7fHjSo9S8J/pub?output=csv';

// Define colors for each status
const statusColors = {
  'N/A': "#303bc9",
  'Retraction': '#e02d19',
  'EoC': '#fab0a7'
};

let selectedCitation = "Citations";

// Fetch the data from the Google Spreadsheet
d3.csv(spreadsheetUrl).then(data => {
  // Sort the data by Journal_Name and then by Status
  data.sort((a, b) => {
    // Define the desired order
    const order = ['N/A', 'EoC', 'Retraction'];
    
    // Get the index of status in the desired order
    const statusIndexA = order.indexOf(a.Status);
    const statusIndexB = order.indexOf(b.Status);

    // If the statuses are different, sort by status index
    if (statusIndexA !== statusIndexB) {
      return statusIndexA - statusIndexB;
    } else {
      // If the statuses are the same, sort by Journal_Name
      return a.Journal_Name.localeCompare(b.Journal_Name);
    }
  });

  // Group data by Journal_Name
  const groupedData = d3.group(data, d => d.Journal_Name);

  // Sort groupedData by total count in increasing order
  const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => b[1].length - a[1].length);

  // Calculate maximum count for x axis
  const maxCount = d3.max(sortedGroupedData, d => d[1].length);

  // D3.js code for visualization
  const margin = { top: 20, right: 20, bottom: 50, left: 100 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = d3.select("#chart")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Define scales using sorted data
  const xScale = d3.scaleLinear()
    .domain([0, maxCount+1])
    .range([0, width]);

  const yScale = d3.scaleBand()
    .range([0, height])
    .padding(0.1);

  // Set yScale domain after data is loaded
  yScale.domain(sortedGroupedData.map(d => d[0]));

  // Draw x-axis
  svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(xScale));

  // Draw y-axis
  const yAxis = svg.append("g")
    .call(d3.axisLeft(yScale).tickSize(0));

  yAxis.selectAll(".tick text")
    .call(wrap, margin.left - 10);

  let filteredData = sortedGroupedData; // Initialize filteredData with all data

  var log_scale_checkbox = d3.select("#log-scale-checkbox")
  log_scale_checkbox.on("change",updateVisualization)

  // Create a dropdown menu or selection field in your HTML
  const selectIRBNumber = d3.select("#IRBNumberSelect")
    .on("change", function() {
      console.log("-------------------")
      console.log("SORTING STARTED")
      console.log("sortedGroupedData")
      console.dir(sortedGroupedData)
      const selectedIRBNumber = this.value; // Get the selected IRB_Number value
      if (selectedIRBNumber === "All") {
        filteredData = sortedGroupedData; // Show all data
      } else {
        filteredData = sortedGroupedData.map(group => {
          const filteredItems = group[1].filter(item => {
            console.log("Checking IRB_Number:", item.IRB_Number);
            console.log("Selected IRB_Number:", selectedIRBNumber);

            // Convert to strings if they are not already
            const itemIRB = String(item.IRB_Number);
            const selectedIRB = String(selectedIRBNumber);

            if (itemIRB !== item.IRB_Number) {
              console.log("Converted IRB_Number to string:", itemIRB);
            }

            if (selectedIRB !== selectedIRBNumber) {
              console.log("Converted selectedIRBNumber to string:", selectedIRB);
            }

            return itemIRB === selectedIRB; // Compare as strings
          });

          return [group[0], filteredItems]; // Return group with filtered items
        });
      }
      updateVisualization();
      console.log("filteredData")
      console.dir(filteredData)
      console.log("SORTING FINISHED")
      console.log("-------------------")
    });

  // Add an option for "All" IRB_Numbers
  selectIRBNumber.append("option").text("All").attr("value", "All");

  // Add options for each unique IRB_Number
  const uniqueIRBNumbers = Array.from(new Set(data.map(d => d.IRB_Number)));
  uniqueIRBNumbers.forEach(number => {
    selectIRBNumber.append("option").text(number).attr("value", number);
  });

  // Add legend
  const legend = d3.select("#legend");

  Object.entries(statusColors).forEach(([status, color]) => {
    const legendItem = legend.append("div").attr("class", "legend-item");
    legendItem.append("div")
      .attr("class", "legend-item__color")
      .style("background-color", color);
    legendItem.append("span").text(status);
  });


  selectCitationType = d3.select("#citationType")
    .on("change", function() {
      // Update citation scale based on selected value
      //citationScale.domain([0, d3.max(data, d => parseFloat(d[selectedCitationType]))]);
      console.log("UPDATE")
      updateVisualization();
    });

  function updateVisualization() {

      selectedCitation = d3.select("#citationType").property("value")

      // Update yScale domain based on filteredData
      yScale.domain(filteredData.map(d => d[0]));

      // Select and update existing bars
      const barGroups = svg.selectAll(".bar-group")
          .data(filteredData, d => d[0]);

      barGroups.exit()
          .transition()
          .duration(500)
          .remove(); // Remove bars for data that no longer exists

      const enterBars = barGroups.enter()
          .append("g")
          .attr("class", "bar-group")

      // Calculate citation scale
      const maxRadius = yScale.bandwidth() / 2; // Maximum radius is half of the space available for each bar
      let citationScale;
      if (document.getElementById("log-scale-checkbox").checked) {
        citationScale = d3.scaleLog()
          .base(10)
          .domain([1, d3.max(filteredData.flatMap(d => d[1]), d => parseFloat(d[selectedCitation]))])
          .range([5, Math.pow(maxRadius, 2)]);
      } else {
        citationScale = d3.scaleLinear()
          .domain([0, d3.max(filteredData.flatMap(d => d[1]), d => parseFloat(d[selectedCitation]))])
          .range([5, Math.pow(maxRadius, 2)]);
      }

      // For circle-point
      const circlesPoint = enterBars.merge(barGroups)
          .selectAll(".circle-point")
          .data(d => d[1]);

      circlesPoint.exit()
          .transition()
          .duration(700)
          .attr("r", 0)
          .remove(); // Remove circles for data that no longer exists

      circlesPoint.enter()
          .append("circle")
          .attr("class", "circle-point")
          .attr("r", 0) // Set initial radius to 0 for smooth transition
          .attr("cx", (d, i) => xScale(i + 1)) // Use the index to determine x position
          .attr("cy", d => yScale(d.Journal_Name) + yScale.bandwidth() / 2) // Use Journal_Name for y position
          .merge(circlesPoint)
          .transition()
          .duration(500)
          .attr("r", 5)
          .attr("fill", d => statusColors[d.Status])
          .attr("original-fill", d => statusColors[d.Status])
          .attr("id", d => "point_"+d.DOI)

      // For circle-citation
      const circlesCitation = enterBars.merge(barGroups)
          .selectAll(".circle-citation")
          .data(d => d[1]);

      circlesCitation.exit()
          .transition()
          .duration(700)
          .attr("r", 0)
          .remove(); // Remove circles for data that no longer exists

      circlesCitation.enter()
          .append("circle")
          .attr("class", "circle-citation")
          .attr("r", 0) // Set initial radius to 0 for smooth transition
          .attr("cx", (d, i) => xScale(i + 1)) // Use the index to determine x position
          .attr("cy", d => yScale(d.Journal_Name) + yScale.bandwidth() / 2) // Use Journal_Name for y position
          .merge(circlesCitation)
          .transition()
          .duration(500)
          .attr("r", d => Math.sqrt(citationScale(parseFloat(d[selectedCitation])))) // Scale the radius based on the square root
          .attr("fill", d => d3.color(statusColors[d.Status]))
          .attr("fill-opacity", 0.3)
          .attr("original-fill", d => statusColors[d.Status])
          .attr("id", d => "citation_"+d.DOI)

        d3.selectAll(".circle-citation").each(function(d) {
          d3.select(this)
              .on("mouseover", function(event, d) {
                  
                  d3.select(this).attr("fill", "yellow")
                  d3.select("#point_"+d.DOI).attr("fill", "yellow")
                  updateInfo(d)

              })
              .on("mouseout", function(event, d) {
                  let tmp = d3.select(this)
                  tmp.attr("fill", tmp.attr("original-fill"))
                  tmp = d3.select("#point_"+d.DOI)
                  tmp.attr("fill", tmp.attr("original-fill"))
                  
              });
      });


  }

  updateVisualization("Citations"); // Draw initial visualization

}).catch(error => {
  console.error('Error fetching the data:', error);
});

function updateInfo(d){
    // Display row information
    d3.select("#DOI").text(d.DOI);
    d3.select("#Title").text(d.Title);
    d3.select("#Journal_Name").text(d.Journal_Name);
    d3.select("#Status").text(d.Status);
    d3.select("#IRB_Number").text(d.IRB_Number);
    d3.select("#Citations").text(d.Citations);
    d3.select("#Self_Citations").text(d.Self_Citations);
    d3.select("#Altmetrics").text(d.Altmetrics);
    d3.select("#DOI_Status").text(d.DOI_Status);
}

function wrap(text, width) {
  text.each(function() {
    var text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.1, // ems
      y = text.attr("y"),
      dy = parseFloat(text.attr("dy") || 0),
      tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
      }
    }
  });
}
