/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

package foam.lib.csv;

import foam.core.*;
import foam.dao.AbstractSink;
import foam.lib.json.OutputterMode;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.TimeZone;
import java.util.stream.Collectors;

public class Outputter
    extends AbstractSink
{

  protected ThreadLocal<SimpleDateFormat> sdf = new ThreadLocal<SimpleDateFormat>() {
    @Override
    protected SimpleDateFormat initialValue() {
      SimpleDateFormat df = new SimpleDateFormat("YYYY-MM-dd'T'HH:mm:ss.S'Z'");
      df.setTimeZone(TimeZone.getTimeZone("UTC"));
      return df;
    }
  };

  protected ThreadLocal<StringBuilder> sb = new ThreadLocal<StringBuilder>() {
    @Override
    protected StringBuilder initialValue() {
      return new StringBuilder();
    }

    @Override
    public StringBuilder get() {
      StringBuilder b = super.get();
      b.setLength(0);
      return b;
    }
  };

  public final OutputterMode mode;
  public final boolean outputHeaders;

  public Outputter() {
    this(OutputterMode.FULL);
  }

  public Outputter(OutputterMode mode) {
    this(mode, true);
  }

  public Outputter(OutputterMode mode, boolean outputHeaders) {
    this.mode = mode;
    this.outputHeaders = outputHeaders;
  }

  public String stringify(FObject obj) {
    StringBuilder builder = sb.get();
    if ( outputHeaders )
      outputHeaders(builder, obj);
    outputFObject(builder, obj);
    return builder.toString();
  }

  /**
   * Gets a filtered list of properties. Removes network and storage transient variables
   * if necessary, removes unsupported types and removes null values / empty strings
   * @param obj the object to get the property list from
   * @return the filtered list of properties
   */
  public List<PropertyInfo> getFilteredPropertyInfoList(FObject obj) {
    List<PropertyInfo> props = obj.getClassInfo().getAxiomsByClass(PropertyInfo.class);
    return props.stream().filter(prop -> {
      // filter out network and storage transient values
      if ( mode == OutputterMode.NETWORK && prop.getNetworkTransient() ) return false;
      if ( mode == OutputterMode.STORAGE && prop.getStorageTransient() ) return false;

      // filter out unsupported types
      if ( prop instanceof AbstractArrayPropertyInfo ||
          prop instanceof AbstractFObjectArrayPropertyInfo ||
          prop instanceof AbstractFObjectPropertyInfo ) {
        return false;
      }

      Object value = prop.f(obj);
      return value != null && (!(value instanceof String) || !((String) value).isEmpty());
    })
        .collect(Collectors.toList());
  }

  public void outputHeaders(StringBuilder out, FObject obj) {
    List<PropertyInfo> props = getFilteredPropertyInfoList(obj);
    Iterator i = props.iterator();

    while ( i.hasNext() ) {
      PropertyInfo prop = (PropertyInfo) i.next();
      out.append(prop.getName());
      if ( i.hasNext() )
        out.append(",");
    }
    out.append("\n");
  }

  public String escape(String s) {
    return s.replace("\n","\\n").replace("\"", "\\\"");
  }

  protected void outputString(StringBuilder out, String s) {
    if ( s == null || s.isEmpty() ) return;
    out.append(escape(s));
  }

  protected void outputNumber(StringBuilder out, Number value) {
    out.append(value.toString());
  }

  protected void outputBoolean(StringBuilder out, Boolean value) {
    out.append(value ? "true" : "false");
  }

  protected void outputDate(StringBuilder out, Date value) {
    outputString(out, sdf.get().format(value));
  }

  protected void outputFObject(StringBuilder out, FObject obj) {
    List<PropertyInfo> props = getFilteredPropertyInfoList(obj);
    Iterator i = props.iterator();

    while ( i.hasNext() ) {
      PropertyInfo prop = (PropertyInfo) i.next();
      prop.toCSV(this, out, prop.f(obj));
      if ( i.hasNext() )
        out.append(",");
    }
    out.append("\n");
  }

  public void output( StringBuilder out, Object value ) {
    if ( value instanceof String ) {
      outputString(out, (String) value);
    } else if ( value instanceof Number ) {
      outputNumber(out, (Number) value);
    } else if ( value instanceof Boolean ) {
      outputBoolean(out, (Boolean) value);
    } else if ( value instanceof Date ) {
      outputDate(out, (Date) value);
    }
  }

  protected StringBuilder data_ = sb.get();

  public String getData() {
    return data_.toString();
  }

  @Override
  public void put(FObject obj, Detachable sub) {
    outputFObject(data_, obj);
  }
}