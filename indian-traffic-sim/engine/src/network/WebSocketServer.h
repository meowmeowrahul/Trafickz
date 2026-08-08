#ifndef NETWORK_WEBSOCKETSERVER_H
#define NETWORK_WEBSOCKETSERVER_H

#include <vector>
#include <thread>
#include <future>
#include <atomic>
#include <functional>
#include <App.h>
#include "../core/AgentTypes.h"

class WebSocketServer {
public:
    WebSocketServer(int port);
    ~WebSocketServer();
    void start();
    void stop();
    void broadcast(const std::vector<AgentState>& states);
    void set_road_json(const std::string& json) { road_json_cache_ = json; }
    void set_control_callback(std::function<void(int, double, double)> cb) { control_callback_ = cb; }

private:
    std::function<void(int, double, double)> control_callback_;
    int port_;
    std::thread server_thread_;
    uWS::Loop* loop_ = nullptr;
    us_listen_socket_t* listen_socket_ = nullptr;
    std::atomic<bool> running_{false};
    std::vector<uWS::WebSocket<false, true, int>*> clients_;
    std::string road_json_cache_;
};

#endif
