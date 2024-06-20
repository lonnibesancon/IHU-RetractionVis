const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSZMRkkQWNEz6zzcOaI3PwJohV6rqS6cYl5rTJm0LrQb9hthouOMdf4YfuDXr2bDgny9F7fHjSo9S8J/pub?output=csv';
//const spreadsheetUrl = 'http://127.0.0.1:8080/data/data.csv';

const statusColors = {
  'N/A': "#303bc9",
  'EoC': '#fec44f',
  'Retracted': '#e02d19',
};

let selectedCitation = "Citations";
let isGrouped = false
let isLogged = false


d3.csv(spreadsheetUrl)
  .then(data => {
    data.sort((a, b) => {
      const order = ['N/A', 'EoC', 'Retracted'];
      const statusIndexA = order.indexOf(a.Status);
      const statusIndexB = order.indexOf(b.Status);
      return statusIndexA - statusIndexB || a.Journal_Name.localeCompare(b.Journal_Name);
    });

    const groupedData = d3.group(data, d => d.Journal_Name);
    const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => b[1].length - a[1].length);

    let maxCount = d3.max(sortedGroupedData, d => d[1].length);

    let min_value = 10;
    let max_value = 14;


    const margin = { top: 20, right: 20, bottom: 50, left: 100 };
    const width = 1200 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    d3.select("#log-scale-checkbox").on("change", updateVisualization);
    d3.select("#grouped-checkbox").on("change", updateVisualization);

    const svg = d3.select("#chart")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const xScale = d3.scaleLinear()
      .domain([0, maxCount + 1])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .range([0, height])
      .padding(0.1);

    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(xScale));

    svg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).tickSize(0));

    let filteredData = sortedGroupedData;
    filteredData = sortedGroupedData.filter(entry => {
      const count = entry[1].length;
      return count >= min_value && count <= max_value;
    });

    yScale.domain(sortedGroupedData.map(d => d[0]));

    const selectIRBNumber = d3.select("#IRBNumberSelect")
      .on("change", function () {
        const selectedIRBNumber = this.value;
        if (selectedIRBNumber === "All") {
          filteredData = sortedGroupedData;
        } else {
          filteredData = sortedGroupedData.map(group => {
            const filteredItems = group[1].filter(item => String(item.IRB_Number) === String(selectedIRBNumber));
            return [group[0], filteredItems];
          });
        }
        updateVisualization();
      });

    const selectAuthor = d3.select("#AuthorSelect")
    .on("change", function () {
        const selectedAuthor = this.value;
        if (selectedAuthor === "All") {
          filteredData = sortedGroupedData;
        } else {
          //Still have to implement the logic for it
          //Logic here is based on logic from IRB
          filteredData = sortedGroupedData.map(group => {
            const filteredItems = group[1].filter(item => String(item.IRB_Number) === String(selectedIRBNumber));
            return [group[0], filteredItems];
          });
        }
        updateVisualization();
      });

    selectAuthor.append("option").text("All").attr("value", "All");
    selectIRBNumber.append("option").text("All").attr("value", "All");

    const uniqueIRBNumbers = Array.from(new Set(data.map(d => d.IRB_Number)));
    uniqueIRBNumbers.forEach(number => {
      selectIRBNumber.append("option").text(number).attr("value", number);
    });

    const legend = d3.select("#legend");

    Object.entries(statusColors).forEach(([status, color]) => {
      const legendItem = legend.append("div").attr("class", "legend-item");
      legendItem.append("div")
        .attr("class", "legend-item__color")
        .style("background-color", color);
      legendItem.append("span").text(status);
    });

    selectCitationType = d3.select("#citationType")
      .on("change", function () {
        console.log("UPDATE");
        updateVisualization();
      });





    function updateVisualization() {

      //First we update all of the values needed for the visualization
      isGrouped = d3.select("#grouped-checkbox").property("checked");
      isLogged = d3.select("#log-scale-checkbox").property("checked");
      selectedCitation = d3.select("#citationType").property("value");
      yScale.domain(filteredData.map(d => d[0]));

      // Redefine and recalculate the barGroups based on the filteredData
      const barGroups = svg.selectAll(".bar-group")
        .data(filteredData, d => d[0]);

      // Handle the exit for all existing elements
      barGroups.exit()
        .transition()
        .duration(500)
        .attr("opacity", 0)
        .remove();

      // Enter new data
      const enterBars = barGroups.enter()
        .append("g")
        .attr("class", "bar-group");

      // Update the maxCount based on the new data
      maxCount = d3.max(filteredData, d => d[1].length);
      xScale.domain([0, maxCount + 1]);

      // Choose whether to display bars or circles based on a condition, e.g., based on maxRadius
      const maxRadius = d3.min([yScale.bandwidth() / 2, xScale(1) - xScale(0)]);
      const pointRadiusThreshold = 0.01 * width;


      console.log("isLogged")
      console.log(isLogged)
      console.log("isGrouped")
      console.log(isGrouped)
      console.log(d3.select("#grouped-checkbox").property("checked"))

      // Clear old bars or circles
      svg.selectAll(".stacked-bar-group, .circle-point, .circle-citation").remove();

      console.log("filteredData")
      console.dir(filteredData)

      if (isGrouped || maxRadius < pointRadiusThreshold) {
        // Logic for displaying bars
        displayBars(enterBars, barGroups);
      } else {
        // Logic for displaying circles
        displayCircles(enterBars, barGroups, maxRadius);
      }

      updateAxes();
    }

function displayBars(enterBars, barGroups) {
  let bars = enterBars.merge(barGroups).selectAll(".stacked-bar-group")
    .data(d => {
        const statusData = Object.entries({ 'N/A': 0, 'EoC': 0, 'Retracted': 0 })
          .map(([status]) => {
            const statusCount = d[1].filter(item => item.Status === status).length;
            return { status, count: statusCount };
          });

        console.log("[{ Journal_Name: d[0], statusData: statusData }] = ")
        let array = [{ Journal_Name: d[0], statusData: statusData }]
        console.dir(array)
        //console.log("Status Data for " + d[0] + ":", [{ Journal_Name: d[0], statusData: statusData }]);
        return (array);
  });

  console.log("Number of stacked-bar-group elements after data binding:", bars.size());

  console.log("Data")
  console.dir(bars.data())

  const barGroupsEnter = bars.enter()
    .append("g")
    .attr("class", "stacked-bar-group")
    .attr("transform", d => `translate(${xScale(0)}, ${yScale(d.Journal_Name)})`);

  barGroupsEnter.merge(bars).selectAll(".stacked-bar")
    .data(d => d.statusData)
    .enter()
    .append("rect")
    .attr("class", "stacked-bar")
    .attr("x", (d, i, nodes) => {
      let prevWidth = d3.sum(d.statusData.slice(0, i), item => item.count);
      return xScale(prevWidth);
      })
    .attr("y", 0)
    .attr("width", d => xScale(d.count))
    .attr("height", yScale.bandwidth())
    .attr("fill", d => statusColors[d.status]);
}

function displayCircles(enterBars, barGroups, maxRadius) {
  const citationScale = d3.scaleLinear()
      .domain([0, d3.max(filteredData.flatMap(d => d[1]), d => parseFloat(d[selectedCitation]))])
      .range([5, Math.pow(maxRadius, 2)]);

  let circles = enterBars.merge(barGroups).selectAll(".circle-citation")
    .data(d => d[1])
    .enter()
    .append("circle")
    .attr("class", "circle-citation")
    .attr("cx", (d, i) => xScale(i + 1))
    .attr("cy", d => yScale(d.Journal_Name) + yScale.bandwidth() / 2)
    .attr("r", d => parseFloat(d[selectedCitation]) === 0 ? 5 : Math.sqrt(citationScale(parseFloat(d[selectedCitation]))))
    .attr("fill", d => statusColors[d.Status])
    .attr("fill-opacity", 0.3)
    .attr("original-fill", d => statusColors[d.Status])
    .attr("id", d => "point_" + d.Line_ID)
    .on("mouseover", function(event, d) {
      d3.select(this).attr("fill", "yellow");
      d3.select("#point_" + d.Line_ID).attr("fill", "yellow");
      updateInfo(d);
    })
    .on("mouseout", function(event, d) {
      let tmp = d3.select(this);
      tmp.attr("fill", tmp.attr("original-fill"));
      tmp = d3.select("#point_" + d.Line_ID);
      tmp.attr("fill", tmp.attr("original-fill"));
    })
    .transition()
    .duration(500);
  }



    updateVisualization("Citations");
    updateAxes();

    function updateAxes() {
      console.log("xScale.domain()")
      console.dir(xScale.domain())
      svg.select(".x-axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));
      svg.select(".y-axis")
        .call(d3.axisLeft(yScale).tickSize(0))
        .selectAll(".tick text")
        .call(wrap, margin.left - 10);
    }
  })
  .catch(error => {
    console.error('Error fetching the data:', error);
  });

function updateInfo(d) {
  d3.select("#DOI").html(`<a href="https://doi.org/${d.DOI}" target="_blank">${d.DOI}</a>`);
  d3.select("#Title").text(d.Title);
  d3.select("#Journal_Name").text(d.Journal_Name);
  d3.select("#Status").text(d.Status);
  d3.select("#IRB_Number").text(d.IRB_Number);
  d3.select("#Citations").text(d.Citations);
  d3.select("#Self_Citations").text(d.Self_Citations);
  d3.select("#Altmetrics").text(d.Altmetrics);
  if (d.DOI_Status) {
    d3.select("#DOI_Status").html(`<a href="${d.DOI_Status}" target="_blank">${d.DOI_Status}</a>`);
  } else {
    d3.select("#DOI_Status").text('N/A'); // Or any other placeholder text
  }
}


function wrap(text, width) {
  text.each(function () {
    var text = d3.select(this),
      words = text.text().split(/\s+/).reverse(),
      word,
      line = [],
      lineNumber = 0,
      lineHeight = 1.1,
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
