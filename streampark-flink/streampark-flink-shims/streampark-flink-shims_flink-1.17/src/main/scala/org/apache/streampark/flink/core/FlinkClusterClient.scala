/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.apache.streampark.flink.core

import org.apache.flink.api.common.JobID
import org.apache.flink.client.program.ClusterClient
import org.apache.flink.core.execution.SavepointFormatType

import java.util.concurrent.CompletableFuture

class FlinkClusterClient[T](clusterClient: ClusterClient[T])
  extends FlinkClientTrait[T](clusterClient) {

  override def triggerSavepoint(
      jobID: JobID,
      savepointDir: String,
      nativeFormat: Boolean): CompletableFuture[String] = {
    clusterClient.triggerSavepoint(
      jobID,
      savepointDir,
      if (nativeFormat) SavepointFormatType.NATIVE
      else SavepointFormatType.CANONICAL)
  }

  override def cancelWithSavepoint(
      jobID: JobID,
      savepointDirectory: String,
      nativeFormat: Boolean): CompletableFuture[String] = {
    clusterClient.cancelWithSavepoint(
      jobID,
      savepointDirectory,
      if (nativeFormat) SavepointFormatType.NATIVE
      else SavepointFormatType.CANONICAL)
  }

  override def stopWithSavepoint(
      jobID: JobID,
      advanceToEndOfEventTime: Boolean,
      savepointDirectory: String,
      nativeFormat: Boolean): CompletableFuture[String] = {
    clusterClient.stopWithSavepoint(
      jobID,
      advanceToEndOfEventTime,
      savepointDirectory,
      if (nativeFormat) SavepointFormatType.NATIVE
      else SavepointFormatType.CANONICAL)
  }

}
