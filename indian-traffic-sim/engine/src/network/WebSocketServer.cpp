#include "WebSocketServer.h"
#include <iostream>
#include <cstring>
#include <algorithm>
#include <nlohmann/json.hpp>

WebSocketServer::WebSocketServer(int port) : port_(port) {}

WebSocketServer::~WebSocketServer() {
    stop();
}

void WebSocketServer::start() {
    running_ = true;
    std::promise<uWS::Loop*> loop_promise;
    server_thread_ = std::thread([this, &loop_promise]() {
        uWS::App app;
        app.ws<int>("/*", {
            .compression = uWS::DISABLED,
            .maxPayloadLength = 16 * 1024 * 1024,
            .idleTimeout = 120,
            .maxBackpressure = 1 * 1024 * 1024,
            .open = [this](auto* ws) {
                this->clients_.push_back(ws);
                if (!this->road_json_cache_.empty()) {
                    ws->send(this->road_json_cache_, uWS::OpCode::TEXT);
                }
            },
            .message = [this](auto*, std::string_view message, uWS::OpCode opCode) {
                if (opCode == uWS::OpCode::TEXT) {
                    try {
                        auto j = nlohmann::json::parse(message);
                        if (j.contains("type") && j["type"] == "control") {
                            if (this->control_callback_) {
                                int num_agents = j.value("num_agents", -1);
                                double idm_t = j.value("idm_T", -1.0);
                                double sfm_a = j.value("sfm_A", -1.0);
                                this->control_callback_(num_agents, idm_t, sfm_a);
                            }
                        }
                    } catch (const std::exception& e) {
                        std::cerr << "[WebSocket] Control parse error: " << e.what() << "\n";
                    }
                }
            },
            .drain = [](auto*) {},
            .close = [this](auto* ws, int, std::string_view) {
                auto it = std::find(this->clients_.begin(), this->clients_.end(), ws);
                if (it != this->clients_.end()) {
                    this->clients_.erase(it);
                }
            }
        }).listen(port_, [this](auto* token) {
            if (token) {
                this->listen_socket_ = token;
                std::cout << "[WebSocket] Listening on port " << port_ << "\n";
            } else {
                std::cerr << "[WebSocket] Failed to listen on port " << port_ << "\n";
            }
        });
        loop_promise.set_value(uWS::Loop::get());
        app.run();
    });
    loop_ = loop_promise.get_future().get();
}

void WebSocketServer::stop() {
    running_ = false;
    if (loop_) {
        loop_->defer([this]() {
            if (this->listen_socket_) {
                us_listen_socket_close(0, this->listen_socket_);
                this->listen_socket_ = nullptr;
            }
            auto clients_copy = this->clients_;
            for (auto* ws : clients_copy) {
                ws->close();
            }
        });
        if (server_thread_.joinable()) {
            server_thread_.join();
        }
        loop_ = nullptr;
    }
}

void WebSocketServer::broadcast(const std::vector<AgentState>& states) {
    if (!loop_ || clients_.empty()) return;

    std::vector<char> buffer(states.size() * 21);
    for (size_t i = 0; i < states.size(); ++i) {
        size_t offset = i * 21;
        std::memcpy(buffer.data() + offset, &states[i].id, 4);
        uint8_t type = static_cast<uint8_t>(states[i].type);
        std::memcpy(buffer.data() + offset + 4, &type, 1);
        float px = states[i].position.x;
        float py = states[i].position.y;
        float h = states[i].heading;
        float s = states[i].speed;
        std::memcpy(buffer.data() + offset + 5, &px, 4);
        std::memcpy(buffer.data() + offset + 9, &py, 4);
        std::memcpy(buffer.data() + offset + 13, &h, 4);
        std::memcpy(buffer.data() + offset + 17, &s, 4);
    }

    loop_->defer([this, buf = std::move(buffer)]() {
        if (!running_) return;
        std::string_view msg(buf.data(), buf.size());
        for (auto* ws : clients_) {
            ws->send(msg, uWS::OpCode::BINARY);
        }
    });
}
