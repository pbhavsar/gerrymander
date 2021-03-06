"use strict";

module.exports = `// The efficiency gap
var state = options.state;
var state_total = 0;
var d_wasted = 0;
var r_wasted = 0;

for (let dist of state.house_districts) {
 // Impute
 for (let year of ["y2016", "y2014", "y2012"]) {
  for (let party of ["dem", "rep"]) {
   if (dist.votes[year][party + "_votes_house"] === null) {
    if (year === "y2014") {
     dist.votes[year][party + "_votes_house"] = dist.votes.y2012[party + "_votes_pres"]
    }
    else {
     dist.votes[year][party + "_votes_house"] = dist.votes[year][party + "_votes_pres"]
    }
   }
  }
 }

 var d_vote_avg = (dist.votes.y2016.d_votes_house + dist.votes.y2014.d_votes_house + 
  dist.votes.y2012.d_votes_house)/3
 var r_vote_avg = (dist.votes.y2016.r_votes_house + dist.votes.y2014.r_votes_house + 
  dist.votes.y2012.r_votes_house)/3
 var total_votes = d_vote_avg + r_vote_avg;
 state_total += total_votes;
 if (d_vote_avg > r_vote_avg) {
  d_wasted += (d_vote_avg - total_votes / 2);
  r_wasted += r_vote_avg;
 }
 else {
  r_wasted += (r_vote_avg - total_votes / 2);
  d_wasted += d_vote_avg;
 }
};
var include = state.house_districts.length >= 8 ? true : false;
var metric = (r_wasted - d_wasted) / state_total;
var return_obj = {
 metric: metric,
 include: include,
 seats_flipped: metric * state.house_districts.length
}
`