#ifndef PARSER_NETXMLPARSER_H
#define PARSER_NETXMLPARSER_H

#include <string>
#include "../network/NetTypes.h"

class NetXmlParser {
public:
    static NetMap parse(const std::string& filepath);
};

#endif
