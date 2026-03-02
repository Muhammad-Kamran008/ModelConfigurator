package com.example.ModelConfigurator.Core.dto;


import java.util.*;

public class XmlNodeDto {

    private String tag;
    private Map<String, String> attributes = new LinkedHashMap<>();
    private String text;
    private List<XmlNodeDto> children = new ArrayList<>();

    public XmlNodeDto() {}

    public XmlNodeDto(String tag) {
        this.tag = tag;
    }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }

    public Map<String, String> getAttributes() { return attributes; }
    public void setAttributes(Map<String, String> attributes) { this.attributes = attributes; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public List<XmlNodeDto> getChildren() { return children; }
    public void setChildren(List<XmlNodeDto> children) { this.children = children; }
}