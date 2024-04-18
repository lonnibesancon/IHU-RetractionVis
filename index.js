const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSZMRkkQWNEz6zzcOaI3PwJohV6rqS6cYl5rTJm0LrQb9hthouOMdf4YfuDXr2bDgny9F7fHjSo9S8J/pub?output=csv';

const statusColors = {
  'N/A': "#303bc9",
  'EoC': '#fec44f',
  'Retracted': '#e02d19',
};

let selectedCitation = "Citations";

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

    updateAxes();

    let filteredData = sortedGroupedData;
    filteredData = sortedGroupedData.filter(entry => {
      const count = entry[1].length;
      return count >= min_value && count <= max_value;
    });

    yScale.domain(sortedGroupedData.map(d => d[0]));

    d3.select("#log-scale-checkbox").on("change", updateVisualization);

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
      selectedCitation = d3.select("#citationType").property("value");
      yScale.domain(filteredData.map(d => d[0]));
      const barGroups = svg.selectAll(".bar-group")
        .data(filteredData, d => d[0]);
      barGroups.exit()
        .transition()
        .duration(500)
        .remove();
      const enterBars = barGroups.enter()
        .append("g")
        .attr("class", "bar-group");
      const maxRadius = d3.min([yScale.bandwidth() / 2, xScale(1) - xScale(0)]);
      const pointRadiusThreshold = 0.01 * width;
      if (!filteredData || filteredData.length === 0) {
        console.error('Filtered data is undefined or empty');
        return;
      }
      maxCount = d3.max(sortedGroupedData, d => d[1].length);
      xScale.domain([0, maxCount + 1]);
      if (maxRadius > pointRadiusThreshold) {
        let barGroups = svg.selectAll(".bar-group")
          .data(filteredData, d => d[0]);
        barGroups.exit()
          .transition()
          .duration(500)
          .remove();
        const enterBars = barGroups.enter()
          .append("g")
          .attr("class", "bar-group");
        let bars;
        yScale.domain(filteredData.map(d => d[0]));
        bars = enterBars.merge(barGroups)
          .selectAll(".stacked-bar-group")
          .data(d => [{ Journal_Name: d[0], statusData: Object.entries({ 'N/A': 0, 'EoC': 0, 'Retracted': 0 }).map(([status, count]) => ({ status, count: d[1].filter(item => item.Status === status).length })) }]);
        const barGroupsEnter = bars.enter()
          .append("g")
          .attr("class", "stacked-bar-group")
          .attr("transform", d => `translate(${xScale(0)}, ${yScale(d.Journal_Name)})`);
        barGroups = barGroupsEnter.merge(barGroups);
        const stackedBars = barGroups.selectAll(".stacked-bar")
          .data((d) => (d.statusData || []))
          .enter()
          .append("rect")
          .attr("class", "stacked-bar")
          .attr("x", (d, i, nodes) => {
            const parentData = d3.select(nodes[i].parentNode).datum();
            let prevWidth = 0;
            if (i > 0) {
              prevWidth = d3.sum(parentData.statusData.slice(0, i), (item) => item.count);
            }
            return xScale(prevWidth);
          })
          .attr("y", 0)
          .attr("width", (d) => xScale(d.count))
          .attr("height", yScale.bandwidth())
          .attr("fill", (d) => statusColors[d.status]);
      } else {
        const citationScale = d3.scaleLinear()
          .domain([0, d3.max(filteredData.flatMap(d => d[1]), d => parseFloat(d[selectedCitation]))])
          .range([5, Math.pow(maxRadius, 2)]);
        const circlesPoint = enterBars.merge(barGroups)
          .selectAll(".circle-point")
          .data(d => d[1]);
        circlesPoint.exit()
          .transition()
          .duration(700)
          .attr("r", 0)
          .remove();
        circlesPoint.enter()
          .append("circle")
          .attr("class", "circle-point")
          .attr("r", 0)
          .attr("cx", (d, i) => xScale(i + 1))
          .attr("cy", d => yScale(d.Journal_Name) + yScale.bandwidth() / 2)
          .merge(circlesPoint)
          .transition()
          .duration(500)
          .attr("r", 5)
          .attr("fill", d => statusColors[d.Status])
          .attr("original-fill", d => statusColors[d.Status])
          .attr("id", d => "point_" + d.Line_ID);
        const circlesCitation = enterBars.merge(barGroups)
          .selectAll(".circle-citation")
          .data(d => d[1]);
        circlesCitation.exit()
          .transition()
          .duration(700)
          .attr("r", 0)
          .remove();
        circlesCitation.enter()
          .append("circle")
          .attr("class", "circle-citation")
          .attr("r", 0)
          .attr("cx", (d, i) => xScale(i + 1))
          .attr("cy", d => yScale(d.Journal_Name) + yScale.bandwidth() / 2)
          .merge(circlesCitation)
          .transition()
          .duration(500)
          .attr("r", d => parseFloat(d[selectedCitation]) === 0 ? 5 : Math.sqrt(citationScale(parseFloat(d[selectedCitation]))))
          .attr("fill", d => d3.color(statusColors[d.Status]))
          .attr("fill-opacity", 0.3)
          .attr("original-fill", d => statusColors[d.Status])
          .attr("id", d => "point_" + d.Line_ID);
        d3.selectAll(".circle-citation").each(function (d) {
          d3.select(this)
            .on("mouseover", function (event, d) {
              d3.select(this).attr("fill", "yellow");
              d3.select("#point_" + d.Line_ID).attr("fill", "yellow");
              updateInfo(d);
            })
            .on("mouseout", function (event, d) {
              let tmp = d3.select(this);
              tmp.attr("fill", tmp.attr("original-fill"));
              tmp = d3.select("#point_" + d.Line_ID);
              tmp.attr("fill", tmp.attr("original-fill"));
            });
        });
      }
      updateAxes();
    }

    updateVisualization("Citations");

    function updateAxes() {
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
