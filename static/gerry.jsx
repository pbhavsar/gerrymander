"use strict";

const React = require('react');
const ReactDOM = require('react-dom');
const base64 = require('base-64');
const $ = require('jquery');
const wait_until = require('wait-until');
const URI = require('urijs')

const house_data = require('../data/house_by_state.json')
const default_metric = require('./default_metric.js');
const shortener = require('./utils/shortener.js');
const {JavascriptSandbox} = require('./components/sandbox.jsx')

window.gerry_app = {
    iframe_loaded: false
};

gerry_app.display_social_buttons = function(short_url) {
    var share_buttons = document.getElementById('share-buttons');
    while (share_buttons.firstChild) {
        share_buttons.removeChild(share_buttons.firstChild);
    }
    var tweet_text = 'A plausible algorithm to measure partisan gerrymandering?';
    window.twttr.widgets.createShareButton(short_url, share_buttons, { text: tweet_text });
    var fb = '<div class="fb-share-button" data-href="' + short_url + '" data-layout="button"></div>';
    $(share_buttons).append(fb);
    window.FB.XFBML.parse();    
}

gerry_app.update_short_url = function(short_url) {
    $('#share').removeAttr('hidden');
    $('#short-url').val(short_url);
    gerry_app.display_social_buttons(short_url);
}

gerry_app.updateWithMetricData = function (states) {
  gerry_app.sort_by_metric(states);

  var filtered_states = gerry_app.filter_states(states);
  gerry_app.display_state_metrics(filtered_states);

  $('#map-disclaimer').text('Excluded states shown in grey.');
}

gerry_app.sort_by_metric = function(states) {
    states.sort(function(a, b) {
        return parseFloat(Math.abs(b.metric)) - parseFloat(Math.abs(a.metric));
    });
}

gerry_app.filter_states = function(states) {
    return states.filter(function(state) {
        return state.include;
    })    
}

gerry_app.render_map = function(states) {
    var map = d3.geomap.choropleth()
        .geofile('./lib/topojson/countries/USA.json')
        .colors(colorbrewer.RdBu[9])
        .projection(d3.geoAlbersUsa)
        .column('metric')
        .unitId('fips')
        .scale(900)
        .legend(true)
        .width(900)
        .domain([-0.25,0.25])
        .zoomFactor(1);
    $('#map').children().remove();
    map.draw(d3.select("#map").datum(states));
}

var pdf_link_prefix = "https://www2.census.gov/geo/maps/cong_dist/cd114/st_based/CD114_";
var map_url_prefix = "https://nationalmap.gov/small_scale/printable/images/preview/congdist/pagecgd113_";
class TableRow extends React.Component {
    render() {
        var state = this.props.state;
        var num_dem_seats = state.house_districts
            .filter(district => district.votes.y2016.dem_votes_house > district.votes.y2016.rep_votes_house).length;
        var num_rep_seats = state.house_districts
            .filter(district => district.votes.y2016.rep_votes_house > district.votes.y2016.dem_votes_house).length;
        var map_url = map_url_prefix + state.code.toLowerCase() + ".gif";
        var pdf_url = pdf_link_prefix + state.code + ".pdf";
        return (
            <tr id={state.fips}>
                <td>{state.name}</td>
                <td>{state.metric}</td>
                <td>{state.seats_flipped}</td>
                <td>{state.house_districts.length}</td>
                <td>{num_dem_seats}</td>
                <td>{num_rep_seats}</td>
                <td>
                    <a href = 'https://nationalmap.gov/small_scale/printable/congress.html' target='_blank'>
                        <img className='state-map' src={map_url}/>
                    </a>
                </td>
                <td>
                    <a href={pdf_url} target='_blank'> (Census Bureau pdf) </a>
                </td>
            </tr>
        );
    }
}

class StateTable extends React.Component {
    render() {
        var states = this.props.states.map(function (state, index) {
          return (
            <TableRow key={index} state={state}/>
          );
        });
        return (
            <table className='table table-striped'>
                <thead>
                    <tr>
                        <th>State</th>
                        <th>Metric</th>
                        <th>US House Seats Flipped</th>
                        <th>Total US House Districts</th>
                        <th>Actual Dem House Seats, 2016</th>
                        <th>Actual Rep House Seats, 2016</th>
                        <th>Map</th>
                    </tr>
                </thead>
                <tbody>
                    {states}
                </tbody>
            </table>
        );
    }
}

gerry_app.display_state_metrics = function(states) {
    ReactDOM.render(<StateTable states={states} />, document.getElementById('states-table'));
    gerry_app.render_map(states);
}

gerry_app.calculate_metrics = function() {
    var frame = document.getElementById('js-sandbox');
    var data = {
        "states": gerry_app.house_json.states,
        "algorithm": $('#metric-function').val()
    }
    wait_until()
        .interval(500)
        .times(10)
        .condition(function() {
            return (gerry_app.iframe_loaded);
        })
        .done(function(result) {
            frame.contentWindow.postMessage(data, '*');
    });
}

gerry_app.display_input_data = function(state_data) {
    $("#state-data-area").val(JSON.stringify(state_data, undefined, 4));
}

gerry_app.initialize_sandbox = function() {
  let component = <SandboxWrapper
                    states={gerry_app.house_json.states}
                    onCalculate={gerry_app.updateWithMetricData} />
  ReactDOM.render(component, document.getElementById('metric-sandbox'));
}


class SandboxWrapper extends React.Component {
  /**
   * @props [Object] states - Array of states data
   * @props [Function] onCalculate - Callback to be executed with the result of calculating the metric
   */
  constructor(props) {
    super(props);
    this.state = {
      fnString: ''
    }
  }

  render() {
    return (
      <JavascriptSandbox
        states={gerry_app.house_json.states}
        fnString={this.state.fnString}
        onCalculate={gerry_app.updateWithMetricData} />

    )
  }

  componentWillMount() {
    this.fetch_metric_function()
      .then((fnString) => {
        this.setState({fnString: fnString})
      })
  }


  fetch_metric_function() {
    let uri = new URI(window.location.href)
    let gist = uri.query(true).gist || 'pbhavsar/c228879badcf21eb42bad78ceb6f1e4b'
    let gist_url = `https://gist.githubusercontent.com/${gist}/raw`

    return fetch(gist_url, {mode: 'cors'})
      .then((response) => {
        if(response.ok) {
          return response.text()
        } else {
          throw Error(response)
        }
      })
  }

}

$(function() {
    gerry_app.house_json = house_data;
    gerry_app.initialize_sandbox();

    var calculate_button = $('#calculate-metric');
    calculate_button.click(gerry_app.calculate_metrics);

    gerry_app.render_map(gerry_app.house_json.states);
    gerry_app.display_input_data(gerry_app.house_json.states)
    if (window.location.search === "") {
        calculate_button.click();
    }
});
