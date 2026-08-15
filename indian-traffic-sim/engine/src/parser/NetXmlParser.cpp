#include "NetXmlParser.h"
#include <pugixml.hpp>
#include <iostream>
#include <sstream>

static std::vector<Vec2> parse_shape(const std::string& shape_str) {
    std::vector<Vec2> pts;
    std::stringstream ss(shape_str);
    std::string token;
    while (std::getline(ss, token, ' ')) {
        if (token.empty()) continue;
        size_t comma = token.find(',');
        if (comma != std::string::npos) {
            double x = std::stod(token.substr(0, comma));
            double y = std::stod(token.substr(comma + 1));
            pts.push_back({x, y});
        }
    }
    return pts;
}

NetMap NetXmlParser::parse(const std::string& filepath) {
    NetMap map;
    if (filepath.empty()) return map; // skip parsing if empty for now
    pugi::xml_document doc;
    pugi::xml_parse_result result = doc.load_file(filepath.c_str());
    if (!result) {
        std::cerr << "[MapParser] Failed to load " << filepath << "\n";
        return map;
    }

    for (pugi::xml_node edge = doc.child("net").child("edge"); edge; edge = edge.next_sibling("edge")) {
        std::string id = edge.attribute("id").value();

        NetEdge ne;
        ne.id = id;
        ne.is_internal = (edge.attribute("function") && std::string(edge.attribute("function").value()) == "internal");
        ne.from_junction = edge.attribute("from").value();
        ne.to_junction = edge.attribute("to").value();

        for (pugi::xml_node lane = edge.child("lane"); lane; lane = lane.next_sibling("lane")) {
            ne.num_lanes++;
            if (lane.attribute("speed")) ne.speed_limit = lane.attribute("speed").as_double(13.89);
            if (lane.attribute("width")) ne.width = lane.attribute("width").as_double(3.2);
            if (lane.attribute("shape")) ne.lane_shapes.push_back(parse_shape(lane.attribute("shape").value()));
        }
        map.edges[id] = ne;
    }

    for (pugi::xml_node junction = doc.child("net").child("junction"); junction; junction = junction.next_sibling("junction")) {
        std::string id = junction.attribute("id").value();
        if (!id.empty() && id[0] == ':') continue; // internal junction

        NetJunction nj;
        nj.id = id;
        nj.position = {junction.attribute("x").as_double(), junction.attribute("y").as_double()};
        nj.type = junction.attribute("type").value();
        if (junction.attribute("shape")) nj.shape = parse_shape(junction.attribute("shape").value());
        
        std::string incLanes = junction.attribute("incLanes").value();
        std::stringstream ss(incLanes);
        std::string lane_id;
        while (std::getline(ss, lane_id, ' ')) {
            if (lane_id.empty()) continue;
            size_t us = lane_id.rfind('_');
            if (us != std::string::npos) {
                std::string e_id = lane_id.substr(0, us);
                if (e_id[0] != ':') nj.incoming_edges.push_back(e_id);
            }
        }
        map.junctions[id] = nj;
    }

    for (pugi::xml_node conn = doc.child("net").child("connection"); conn; conn = conn.next_sibling("connection")) {
        std::string from = conn.attribute("from").value();
        std::string to = conn.attribute("to").value();
        std::string via = conn.attribute("via").value();
        if (!from.empty() && from[0] != ':' && !to.empty() && to[0] != ':') {
            NetConnection nc;
            nc.from_edge = from;
            nc.to_edge = to;
            nc.from_lane = conn.attribute("fromLane").as_int(0);
            nc.to_lane = conn.attribute("toLane").as_int(0);
            nc.via = via;
            map.connections.push_back(nc);
            
            auto it = map.edges.find(from);
            if (it != map.edges.end()) {
                auto& junc = map.junctions[it->second.to_junction];
                bool exists = false;
                for (const auto& out : junc.outgoing_edges) if (out == to) exists = true;
                if (!exists) junc.outgoing_edges.push_back(to);
            }
        }
    }

    std::cout << "[MapParser] Loaded " << map.edges.size() << " edges, " << map.junctions.size() << " junctions.\n";
    return map;
}
